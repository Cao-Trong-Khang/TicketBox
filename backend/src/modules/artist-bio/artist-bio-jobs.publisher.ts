import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { getArtistBioConfig, getKafkaConfig } from '../../config/app.config';
import { AiBioRequestedEvent } from './artist-bio.types';

@Injectable()
export class ArtistBioJobsPublisher implements OnModuleDestroy {
  private readonly producer: Producer;
  private readonly topic: string;
  private connected = false;

  constructor(configService: ConfigService) {
    const config = getArtistBioConfig(configService);
    this.topic = config.topic;
    this.producer = new Kafka({ clientId: 'ticketbox-ai-bio-api', brokers: getKafkaConfig(configService).brokers }).producer();
  }

  async publish(event: AiBioRequestedEvent): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
    await this.producer.send({
      topic: this.topic,
      acks: -1,
      messages: [{ key: event.document_id, value: JSON.stringify(event) }],
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) await this.producer.disconnect();
  }
}
