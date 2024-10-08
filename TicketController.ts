import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import Ticket from "../models/Ticket";
import { validate } from "class-validator";
import { plainToClass } from "class-transformer";
import { sanitize } from "class-sanitizer";
import { Mutex } from "async-mutex";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketUUIDService from "../services/TicketServices/ShowTicketFromUUIDService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import ListTicketsServiceKanban from "../services/TicketServices/ListTicketsServiceKanban";

import CreateLogTicketService from "../services/TicketServices/CreateLogTicketService";
import ShowLogTicketService from "../services/TicketServices/ShowLogTicketService";
import FindOrCreateATicketTrakingService from "../services/TicketServices/FindOrCreateATicketTrakingService";
import ListTicketsServiceReport from "../services/TicketServices/ListTicketsServiceReport";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";

// Adicione classes de validação para as consultas
class IndexQuery {
  @IsOptional()
  @IsString()
  searchParam: string;

  @IsOptional()
  @IsNumberString()
  pageNumber: string;

  @IsOptional()
  @IsString()
  status: string;

  // Adicione mais campos conforme necessário
}

class IndexQueryReport {
  @IsOptional()
  @IsString()
  searchParam: string;

  @IsOptional()
  @IsNumberString()
  contactId: string;

  // Adicione mais campos conforme necessário
}

class TicketData {
  @IsNumber()
  contactId: number;

  @IsString()
  status: string;

  @IsNumber()
  queueId: number;

  @IsNumber()
  userId: number;

  @IsOptional()
  @IsBoolean()
  sendFarewellMessage?: boolean;

  @IsOptional()
  @IsString()
  whatsappId?: string;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const queryParams = plainToClass(IndexQuery, req.query);
  const errors = await validate(queryParams);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  sanitize(queryParams);

  const {
    pageNumber,
    status,
    date,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages,
    whatsapps: whatsappIdsStringified,
    statusFilter: statusStringfied
  } = queryParams;

  const userId = Number(req.user.id);
  const { companyId } = req.user;

  let queueIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];
  let whatsappIds: number[] = [];
  let statusFilters: string[] = [];

  try {
    if (queueIdsStringified) {
      queueIds = JSON.parse(queueIdsStringified);
    }
    if (tagIdsStringified) {
      tagsIds = JSON.parse(tagIdsStringified);
    }
    if (userIdsStringified) {
      usersIds = JSON.parse(userIdsStringified);
    }
    if (whatsappIdsStringified) {
      whatsappIds = JSON.parse(whatsappIdsStringified);
    }
    if (statusStringfied) {
      statusFilters = JSON.parse(statusStringfied);
    }
  } catch (error) {
    return res.status(400).json({ error: "Invalid JSON in query parameters" });
  }

  const { tickets, count, hasMore } = await ListTicketsService({
    searchParam,
    tags: tagsIds,
    users: usersIds,
    pageNumber,
    status,
    date,
    showAll,
    userId,
    queueIds,
    withUnreadMessages,
    whatsappIds,
    statusFilters,
    companyId
  });

  return res.status(200).json({ tickets, count, hasMore });
};

// Implemente correções semelhantes para outras funções...

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = plainToClass(TicketData, req.body);
  const errors = await validate(ticketData);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const { companyId } = req.user;

  const mutex = new Mutex();
  try {
    const { ticket } = await mutex.runExclusive(async () => {
      const result = await UpdateTicketService({
        ticketData,
        ticketId,
        companyId
      });
      return result;
    });

    return res.status(200).json(ticket);
  } catch (error) {
    return res.status(500).json({ error: "An error occurred while updating the ticket" });
  }
};

// Continue implementando correções semelhantes para as demais funções...
