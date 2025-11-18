import { SMS_PAGINATION_SIZE } from '../../constants';

export const getSmsMessages = async (args: { state?: string }, context: any) => {
  const { state } = args;

  if (state === 'received') {
    // Show incoming SMS messages
    return context.entities.SmsMessage.findMany({
      where: { direction: 'incoming' },
      orderBy: { createdAt: 'desc' },
      take: SMS_PAGINATION_SIZE
    });
  } else if (state === 'sending') {
    // Show outgoing SMS messages that haven't been sent yet (no sentMessageId)
    return context.entities.OutgoingSmsMessage.findMany({
      where: { sentMessageId: null },
      orderBy: { createdAt: 'desc' },
      take: SMS_PAGINATION_SIZE
    });
  } else if (state === 'sent') {
    // Show outgoing SMS messages that have been sent
    return context.entities.SmsMessage.findMany({
      where: { direction: 'outgoing' },
      orderBy: { createdAt: 'desc' },
      take: SMS_PAGINATION_SIZE
    });
  } else if (state === 'failed') {
    // Show failed outgoing SMS messages
    return context.entities.OutgoingSmsMessage.findMany({
      where: { success: false },
      orderBy: { createdAt: 'desc' },
      take: SMS_PAGINATION_SIZE
    });
  }

  // Default: return all incoming messages when no state specified
  return context.entities.SmsMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: SMS_PAGINATION_SIZE
  });
};

 