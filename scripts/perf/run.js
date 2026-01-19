#!/usr/bin/env node
const axios = require('axios')
const fs = require('fs')
const path = require('path')

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }

function parseArgs(){
  const args = process.argv.slice(2)
  const flags = {}
  const positional = []
  for(const a of args){
    if(a.startsWith('--')){
      const eq = a.indexOf('=')
      if(eq>0){
        const key = a.slice(2,eq)
        const val = a.slice(eq+1)
        flags[key] = val
      } else {
        flags[a.replace(/^--/,'')] = true
      }
    } else positional.push(a)
  }

  return {
    testName: positional[0],
    dryRun: !!flags['dry-run'] || !!flags.dryrun,
    report: flags['report'] || process.env.PERF_REPORT || null,
    reportDir: flags['report-dir'] || process.env.PERF_REPORT_DIR || null,
  }
}

async function runUsersAddresses({ baseUrl, users=1, addressesPerUser=1000, concurrency=20, dryRun }){
  console.log('Performance test: users.addresses')
  console.log(`baseUrl=${baseUrl} users=${users} addressesPerUser=${addressesPerUser} concurrency=${concurrency} dryRun=${dryRun}`)

  const results = []

  for(let u=0; u<users; u++){
    const email = `perf.user.${Date.now()}.${u}@example.com`
    const password = 'perf-pass-1'
    if(dryRun){
      console.log(`[dry] create user ${email}`)
      await sleep(1)
      var token = 'DRY_TOKEN'
    } else {
      try{
        const signup = await axios.post(`${baseUrl}/api/auth/signup`, { name: `Perf User ${u}`, email, password })
        token = signup.data.token
      }catch(err){
        console.error('Failed to create user:', err.message)
        throw err
      }
    }

    const start = Date.now()
    const total = addressesPerUser
    let created = 0

    const doOne = async (i)=>{
      const dto = {
        fullName: `Perf User ${u}`,
        streetLine1: `Addr ${i}`,
        city: 'Testville',
        stateProvince: 'TS',
        postalCode: '00000',
        country: 'US'
      }
      if(dryRun){
        if(i%100===0) process.stdout.write('.')
        return sleep(0)
      }
      await axios.post(`${baseUrl}/api/users/me/addresses`, dto, { headers: { Authorization: `Bearer ${token}` } })
    }

    // run in batches of `concurrency`
    const batch = []
    for(let i=0;i<total;i++){
      batch.push(i)
      if(batch.length>=concurrency || i===total-1){
        const tasks = batch.map(idx => doOne(idx))
        await Promise.all(tasks)
        created += batch.length
        batch.length = 0
      }
    }

    const tookMs = Date.now()-start
    results.push({ user: email, created, tookMs, rps: (created/(tookMs/1000)).toFixed(2) })
    console.log(`\nUser ${email}: created ${created} addresses in ${tookMs}ms (${results[results.length-1].rps} rps)`)
  }

  const summary = {
    test: 'users.addresses',
    baseUrl,
    users,
    addressesPerUser,
    concurrency,
    dryRun: !!dryRun,
    timestamp: new Date().toISOString(),
    results,
    totals: {
      totalCreated: results.reduce((s,r)=>s + (r.created||0), 0),
      totalMs: results.reduce((s,r)=>s + (r.tookMs||0), 0),
    }
  }

  console.log('Summary:')
  console.table(results)

  return summary
}

async function main(){
  const { testName, dryRun, report, reportDir } = parseArgs()
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  const users = Number(process.env.PERF_USERS || 1)
  const addressesPerUser = Number(process.env.ADDRESSES_PER_USER || 1000)
  const concurrency = Number(process.env.PERF_CONCURRENCY || 20)

  if(!testName){
    console.error('Usage: node run.js <testName> [--dry-run]')
    process.exit(2)
  }

  if(testName === 'users.addresses'){
    const summary = await runUsersAddresses({ baseUrl, users, addressesPerUser, concurrency, dryRun })

    // Reporting
    const reportMode = (typeof report === 'string' ? report : null) || null
    const reportDirResolved = reportDir || path.join(process.cwd(),'perf-reports')
    if(reportMode){
      try{
        fs.mkdirSync(reportDirResolved, { recursive: true })
      }catch(e){}

      const ts = new Date().toISOString().replace(/[:.]/g,'-')
      if(reportMode === 'json' || reportMode === 'both'){
        const out = path.join(reportDirResolved, `perf-report-${testName}-${ts}.json`)
        fs.writeFileSync(out, JSON.stringify(summary, null, 2))
        console.log('Wrote JSON report:', out)
      }

      if(reportMode === 'csv' || reportMode === 'both'){
        const out = path.join(reportDirResolved, `perf-report-${testName}-${ts}.csv`)
        const header = 'user,created,tookMs,rps' + '\n'
        const rows = summary.results.map(r => `${r.user},${r.created},${r.tookMs},${r.rps}`).join('\n')
        fs.writeFileSync(out, header + rows)
        console.log('Wrote CSV report:', out)
      }
    }

    process.exit(0)
  }

  console.error('Unknown test:', testName)
  process.exit(2)
}

main().catch(err=>{ console.error(err); process.exit(1) })
