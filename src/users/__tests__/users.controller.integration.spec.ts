import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request = require('supertest')
import { AppModule } from '../../app.module'

describe('UsersController (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/users/me/addresses should require auth', async () => {
    await request(app.getHttpServer()).get('/api/users/me/addresses').expect(401)
  })
})
