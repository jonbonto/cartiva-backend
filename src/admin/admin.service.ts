import { Injectable, UnauthorizedException } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'

interface SessionRecord { user: string; createdAt: number }

@Injectable()
export class AdminService {
  private sessions = new Map<string, SessionRecord>()

  login(username: string, password: string) {
    const ADMIN_USER = process.env.ADMIN_USER || 'admin'
    const ADMIN_PASS = process.env.ADMIN_PASS || 'secret'
    if (username !== ADMIN_USER || password !== ADMIN_PASS) throw new UnauthorizedException()

    const token = uuidv4()
    this.sessions.set(token, { user: username, createdAt: Date.now() })
    return token
  }

  validate(token: string) {
    return this.sessions.has(token)
  }
}
