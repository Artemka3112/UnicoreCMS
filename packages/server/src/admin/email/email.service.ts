import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { envConfig } from 'unicore-common';
import { EmailInput } from './dto/email.input';
import { TestEmailInput } from './dto/test-email.input';
import { EmailMessage } from './entities/email-message.entity';
import { EmailMessageType } from './enums/email-message-type.enum';

@Injectable()
export class EmailService {
  private logger = new Logger(EmailService.name);

  constructor(
    @InjectRepository(EmailMessage)
    private emailMessagesRepository: Repository<EmailMessage>,
    private mailerService: MailerService,
  ) {}

  async generate(): Promise<void> {
    await this.emailMessagesRepository
      .createQueryBuilder()
      .insert()
      .into(EmailMessage)
      .values([
        {
          id: EmailMessageType.Activation,
          title: 'Подтверждение регистрации',
          content: `<h1>Привет, {USERNAME}!</h1><p><br></p><p>Добро пожаловать на {SITENAME}!</p><p>Код активации вашего аккаунта:</p><h2>{CODE}</h2>`,
        },
        {
          id: EmailMessageType.Reset,
          title: 'Восстановление доступа',
          content: `<h1>Сбросить пароль?</h1><p><br></p><p>Вы запросили сброс пароля для {USERNAME}, перейдите по ссылке подтверждения ниже, чтобы завершить процесс. </p><p>{LINK}</p><p><br></p><p>Запрос отправлен с IP: {IP}</p>`,
        },
        {
          id: EmailMessageType.Device,
          title: 'Вход с нового устройства',
          content: `<h1>Привет, {USERNAME}!</h1><p><br></p><p>В ваш аккаунт был выполнен вход с нового устройства, если это не вы, немедленно смените пароль!</p><p><br></p><p>IP-адресс: {IP}</p>`,
        },
      ])
      .orIgnore()
      .execute();
  }

  find(): Promise<EmailMessage[]> {
    return this.emailMessagesRepository.find();
  }

  findOne(id: string): Promise<EmailMessage> {
    return this.emailMessagesRepository.findOne(id);
  }

  async update(id: string, input: EmailInput): Promise<EmailMessage> {
    const message = await this.findOne(id);

    if (!message) {
      throw new NotFoundException();
    }

    message.title = input.title;
    message.content = input.content;

    return this.emailMessagesRepository.save(message);
  }

  test(input: TestEmailInput) {
    return this.mailerService
      .sendMail({
        to: input.email,
        from: envConfig.mailFrom,
        subject: 'Test Email',
        text: 'Test Email sent by UnicoreCMS',
      })
      .then((res) => {})
      .catch((e) => {
        this.logger.error(e.toString());
        throw new ServiceUnavailableException();
      });
  }
}
