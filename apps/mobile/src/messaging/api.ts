import { createMessagingClient } from '@ohun/api-client';
const baseUrl=process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/,'')??'';
export const messagingApi=createMessagingClient({baseUrl});
