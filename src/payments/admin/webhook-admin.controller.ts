import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard'
import { AdminGuard } from '../../auth/guards/admin.guard'
import { WebhookLoggerService } from '../webhook-logger.service'

@Controller('api/admin/webhooks')
@UseGuards(JwtAuthGuard, AdminGuard)
export class WebhookAdminController {
  private readonly logger = new Logger(WebhookAdminController.name)

  constructor(private webhookLoggerService: WebhookLoggerService) {}

  @Get('failed')
  async listFailedWebhooks(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20'
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page) || 1)
      const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20))

      const result = await this.webhookLoggerService.listFailedWebhooks(
        pageNum,
        pageSizeNum,
      )

      this.logger.log(
        `Admin listed failed webhooks: page=${pageNum}, pageSize=${pageSizeNum}`,
      )

      return result
    } catch (error) {
      this.logger.error(`Failed to list webhooks: ${error.message}`)
      throw new InternalServerErrorException('Failed to fetch failed webhooks')
    }
  }

  @Get(':webhookId')
  async getWebhookDetails(@Param('webhookId') webhookId: string) {
    try {
      const webhook = await this.webhookLoggerService.getWebhookLog(webhookId)

      if (!webhook) {
        throw new BadRequestException(`Webhook not found: ${webhookId}`)
      }

      this.logger.log(`Admin viewed webhook: ${webhookId}`)

      return webhook
    } catch (error) {
      if (error instanceof BadRequestException) throw error

      this.logger.error(`Failed to get webhook details: ${error.message}`)
      throw new InternalServerErrorException('Failed to fetch webhook')
    }
  }

  @Post(':webhookId/replay')
  async replayWebhook(@Param('webhookId') webhookId: string) {
    try {
      const webhook = await this.webhookLoggerService.getWebhookLog(webhookId)

      if (!webhook) {
        throw new BadRequestException(`Webhook not found: ${webhookId}`)
      }

      const prepared = await this.webhookLoggerService.prepareForReplay(webhookId)

      this.logger.log(
        `Admin replayed webhook: ${webhookId} (provider: ${webhook.provider}, event: ${webhook.eventType})`,
      )

      return {
        success: true,
        message: 'Webhook prepared for replay',
        webhook: prepared,
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error

      this.logger.error(`Failed to replay webhook: ${error.message}`)
      throw new InternalServerErrorException('Failed to replay webhook')
    }
  }

  @Get()
  async getWebhookStats() {
    try {
      const stats = await this.webhookLoggerService.getWebhookStats()

      this.logger.debug(`Admin viewed webhook stats: ${JSON.stringify(stats)}`)

      return stats
    } catch (error) {
      this.logger.error(`Failed to get webhook stats: ${error.message}`)
      throw new InternalServerErrorException('Failed to fetch webhook statistics')
    }
  }
}
