import { SetMetadata } from '@nestjs/common';

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata('isPublic', true);
