
export const getSmsMessagesByPhoneNumber = async (args: { phoneNumber: string }, context: any) => {
  const { phoneNumber } = args;

  // Get both incoming and outgoing messages
  const smsMessages = await context.entities.SmsMessage.findMany({
    where: { phoneNumber }
  });

  // Get unsent outgoing messages
  const unsentOutgoingMessages = await context.entities.OutgoingSmsMessage.findMany({
    where: {
      phoneNumber,
      sentMessageId: null
    }
  });

  // Combine all messages and sort by creation date (oldest first)
  const allMessages = [
    ...smsMessages,
    ...unsentOutgoingMessages
  ].sort((a, b) => a.createdAt.valueOf() - b.createdAt.valueOf());

  return allMessages;
}; 