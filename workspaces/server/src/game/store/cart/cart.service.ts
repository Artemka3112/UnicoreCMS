import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/admin/users/entities/user.entity';
import { Server } from 'src/game/servers/entities/server.entity';
import { ServersService } from 'src/game/servers/servers.service';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { WarehouseItem } from '../warehouse/entities/warehouse-item.entity';
import { CartItem } from './entities/cart-item.entity';
import * as _ from "lodash"
import { CartItemKit } from './entities/cart-item-kit.entity';
import { CartInput } from './dto/cart.input.dto';
import { PayloadType } from '../dto/paginated-store.dto';
import { Kit } from '../entities/kit.entity';
import { CartItemKitProtected, CartItemProtected, CartProtected, CartUnprotect } from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private cartItemsRepository: Repository<CartItem>,
    @InjectRepository(CartItemKit)
    private cartItemKitsRepository: Repository<CartItemKit>,
    @InjectRepository(WarehouseItem)
    private warehouseItemsRepository: Repository<WarehouseItem>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Kit)
    private kitsRepository: Repository<Kit>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private serversService: ServersService
  ) { }

  private resolver(repo: Repository<WarehouseItem | CartItem>, server: Server, user: User, product: Product) {
    return repo.findOne({ server, user, product })
  }

  private async warehousePusher(user: User, cartItems: CartItem[]) {
    return await Promise.all(cartItems.map(async cartItem => {
      let warehouseItem = await this.resolver(this.warehouseItemsRepository, cartItem.server, user, cartItem.product) as WarehouseItem

      if (warehouseItem) {
        warehouseItem.amount += cartItem.amount
      } else {
        warehouseItem = new WarehouseItem()

        warehouseItem.product = cartItem.product
        warehouseItem.server = cartItem.server
        warehouseItem.user = user
        warehouseItem.amount = cartItem.amount
      }

      return warehouseItem
    }))
  }

  async find(user: User) {
    return this.cartItemsRepository.find({ user })
  }

  async findByServer(user: User, server_id: string) {
    const server = await this.serversService.findOne(server_id)

    if (!server)
      throw new BadRequestException()

    const products = (await this.cartItemsRepository.find({ user, server })).map(payload => ({ type: PayloadType.Product, payload }))
    const kits = (await this.cartItemKitsRepository.find({ user, server })).map(payload => ({ type: PayloadType.Kit, payload }))

    return [...kits, ...products].map(val => new CartProtected(val))
  }

  async add(user: User, body: CartInput) {
    const server = await this.serversService.findOne(body.server_id)

    if (body.type == PayloadType.Product) {
      const product = await this.productsRepository.findOne(body.id, { relations: ["servers"] })

      if (!product || !server || !product.servers.find(srv => srv.id == server.id))
        throw new BadRequestException()

      let cartItem = await this.resolver(this.cartItemsRepository, server, user, product) as CartItem

      if (cartItem) {
        cartItem.amount += body.amount
      } else {
        cartItem = new CartItem()

        cartItem.product = product
        cartItem.server = server
        cartItem.user = user
        cartItem.amount = body.amount
      }

      return this.cartItemsRepository.save(cartItem)
    } else {
      const kit = await this.kitsRepository.findOne(body.id, { relations: ["servers"] })

      if (!kit || !server || !kit.servers.find(srv => srv.id == server.id))
        throw new BadRequestException()

      const cartKitItem = new CartItemKit()

      cartKitItem.kit = kit
      cartKitItem.server = server
      cartKitItem.user = user

      return this.cartItemKitsRepository.save(cartKitItem)
    }
  }

  async clearOwn(user: User, server_id: string) {
    const server = await this.serversService.findOne(server_id) 

    if (!server)
      throw new BadRequestException()

      const cartItems = await this.cartItemsRepository.find({ user, server })
      const cartKitItems = await this.cartItemKitsRepository.find({ user, server })

      return [
        ...(await this.cartItemKitsRepository.remove(cartKitItems)).map(payload => ({ type: PayloadType.Kit, payload })), 
        ...(await this.cartItemsRepository.remove(cartItems)).map(payload => ({ type: PayloadType.Product, payload }))
      ].map(val => new CartProtected(val))
  }

  async clear(user_uuid: string) {
    const user = await this.usersRepository.findOne(user_uuid)
    const cartItems = await this.cartItemsRepository.find({ user })
    const cartKitItems = await this.cartItemKitsRepository.find({ user })

    if (!user)
      throw new BadRequestException()

    return [
      ...(await this.cartItemKitsRepository.remove(cartKitItems)).map(payload => ({ type: PayloadType.Kit, payload })), 
      ...(await this.cartItemsRepository.remove(cartItems)).map(payload => ({ type: PayloadType.Product, payload }))
    ].map(val => new CartProtected(val))
  }

  async removeOwn(user: User, type: PayloadType, id: number) {
    if (type == PayloadType.Product) {
      const cartItem = await this.cartItemsRepository.findOne({ user, id })
      return new CartItemProtected(await this.cartItemsRepository.remove(cartItem))
    } else {
      const cartItemKit = await this.cartItemKitsRepository.findOne({ user, id })
      return new CartItemKitProtected(await this.cartItemKitsRepository.remove(cartItemKit))
    } 
  }

  async remove(id: number) {
    const cartItem = await this.cartItemsRepository.findOne(id)

    return this.cartItemsRepository.remove(cartItem)
  }

  async buy(user: User, server_id: string) {
    const server = await this.serversService.findOne(server_id)

    if (!server)
      throw new BadRequestException()

    const cartItems = await this.cartItemsRepository.find({ where: { user, server }, relations: ["server", "product"] })
    const cartKitItems = await this.cartItemKitsRepository.find({ where: { user, server }, relations: ["server", "kit", "kit.items"] })

    const price = _.sum([
      ...cartItems.map(cartItem => (cartItem.product.price - cartItem.product.price * cartItem.product.sale / 100) * cartItem.amount), 
      ...cartKitItems.map(cartItem => cartItem.kit.price - cartItem.kit.price * cartItem.kit.sale / 100)
    ])

    const cartItemsKits = cartKitItems.map(cartItem => cartItem.kit.items.map(item => {
      const virtualItem = new CartItem()
      virtualItem.product = item.product
      virtualItem.amount = item.amount
      virtualItem.server = cartItem.server
      virtualItem.user = cartItem.user

      return virtualItem
    })).flat()

    if (user.real < price)
      throw new BadRequestException()

    const warehouseItems = await this.warehouseItemsRepository.save(await this.warehousePusher(user, cartItems))

    for (const cik of cartItemsKits) {
      warehouseItems.push((await this.warehouseItemsRepository.save(await this.warehousePusher(user, [cik])))[0])
    }

    user.real = user.real - price

    await this.usersRepository.save(user)
    await this.cartItemsRepository.remove(cartItems)
    await this.cartItemKitsRepository.remove(cartKitItems)
    return warehouseItems.map(wi => new CartItemProtected(wi))
  }
}
