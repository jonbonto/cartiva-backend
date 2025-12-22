import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import cookieParser from 'cookie-parser'
import * as express from 'express'
import { join } from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: true, credentials: true })
  app.use(cookieParser())
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')))
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  const port = process.env.PORT || 3000
  await app.listen(port)
  console.log(`Server listening on http://localhost:${port}`)
}

bootstrap()
