import { Controller, Get } from '@nestjs/common';
import { ConcertsService } from './concerts.service';
import { PublicConcertListItemDto } from './dto/public-concert-list-item.dto';

@Controller('concerts')
export class ConcertsController {
  constructor(private readonly concertsService: ConcertsService) {}

  @Get()
  listPublicConcerts(): Promise<PublicConcertListItemDto[]> {
    return this.concertsService.listPublicConcerts();
  }
}
