import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import { CartItem } from './entities/cart-item.entity';
import { WarehouseItem } from '../warehouse/entities/warehouse-item.entity';
import UsersModule from 'src/admin/users/users.module';
import { ServersModule } from 'src/game/servers/servers.module';
import { User } from 'src/admin/users/entities/user.entity';
import { CartItemKit } from './entities/cart-item-kit.entity';
import { Kit } from '../entities/kit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, CartItem, WarehouseItem, User, CartItemKit, Kit]), UsersModule, ServersModule],
  providers: [CartService],
  controllers: [CartController],
})
export class CartModule {}
