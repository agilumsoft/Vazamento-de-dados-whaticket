import { proto, WASocket } from "@whiskeysockets/baileys";
import cacheLayer from "../libs/cache";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import logger from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  if (!ticket.whatsappId) {
    logger.warn(`Ticket ${ticket.id} has no associated WhatsApp`);
    return;
  }

  try {
    const whatsapp = await ShowWhatsAppService(ticket.whatsappId, ticket.companyId);

    if (!["open", "group"].includes(ticket.status) || !whatsapp || whatsapp.status !== 'CONNECTED' || ticket.unreadMessages <= 0) {
      return;
    }

    const wbot = await GetTicketWbot(ticket);

    const messages = await Message.findAll({
      where: {
        ticketId: ticket.id,
        fromMe: false,
        read: false
      },
      order: [["createdAt", "DESC"]]
    });

    if (messages.length > 0) {
      const readPromises = messages.map(async message => {
        try {
          const msg: proto.IWebMessageInfo = JSON.parse(message.dataJson);
          if (msg.key && msg.key.fromMe === false && !ticket.isBot && (ticket.userId || ticket.isGroup)) {
            await wbot.readMessages([msg.key]);
          }
        } catch (error) {
          logger.error(`Error parsing message ${message.id}: ${error}`);
        }
      });

      await Promise.all(readPromises);
    }

    await Message.update(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );

    await ticket.update({ unreadMessages: 0 });
    await cacheLayer.set(`contacts:${ticket.contactId}:unreads`, "0");

    const io = getIO();

    io.of(ticket.companyId.toString()).emit(`company-${ticket.companyId}-ticket`, {
      action: "updateUnread",
      ticketId: ticket.id
    });

  } catch (err) {
    logger.error(`Could not mark messages as read for ticket ${ticket.id}: ${err}`);
  }
};

export default SetTicketMessagesAsRead;
