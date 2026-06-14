import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ConcertsService } from './concerts.service';
import { PublicConcertDetailDto } from './dto/public-concert-detail.dto';
import { PublicConcertListItemDto } from './dto/public-concert-list-item.dto';

@Controller('concerts')
export class ConcertsController {
  constructor(private readonly concertsService: ConcertsService) {}

  @Get()
  listPublicConcerts(): Promise<PublicConcertListItemDto[]> {
    return this.concertsService.listPublicConcerts();
  }

  @Get(':id')
  getPublicConcertDetail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PublicConcertDetailDto> {
    return this.concertsService.findPublishedConcertDetail(id);
  }
}
