import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import { validate } from "class-validator";
import { plainToClass } from "class-transformer";
import { sanitize } from "class-sanitizer";

class MessageData {
  @IsString()
  wid: string;

  @IsNumber()
  ticketId: number;

  @IsString()
  body: string;

  @IsOptional()
  @IsNumber()
  contactId?: number;

  @IsOptional()
  @IsBoolean()
  fromMe?: boolean;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsString()
  mediaType?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsNumber()
  ack?: number;

  @IsOptional()
  @IsNumber()
  queueId?: number;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsNumber()
  ticketTrakingId?: number;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}

interface Request {
  messageData: MessageData;
  companyId: number;
}

const CreateMessageService = async ({
  messageData,
  companyId
}: Request): Promise<Message> => {
  const validatedMessageData = plainToClass(MessageData, messageData);
  const errors = await validate(validatedMessageData);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.toString()}`);
  }

  sanitize(validatedMessageData);

  const message = await Message.create({ ...validatedMessageData, companyId });

  const fullMessage = await Message.findByPk(message.id, {
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          {
            model: Contact,
            attributes: ["id", "name", "number", "email", "profilePicUrl", "acceptAudioMessage", "active", "urlPicture", "companyId"],
            include: ["extraInfo", "tags"]
          },
          {
            model: Queue,
            attributes: ["id", "name", "color"]
          },
          {
            model: Whatsapp,
            attributes: ["id", "name", "groupAsTicket"]
          },
          {
            model: User,
            attributes: ["id", "name"]
          },
          {
            model: Tag,
            as: "tags",
            attributes: ["id", "name", "color"]
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });

  if (!fullMessage) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  if (fullMessage.ticket.queueId !== null && fullMessage.queueId === null) {
    await fullMessage.update({ queueId: fullMessage.ticket.queueId });
  }

  if (fullMessage.isPrivate) {
    await