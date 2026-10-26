import { useServerQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { Models_Notification } from "@/api/generated/types"

interface NotificationList {
    notifications?: Models_Notification[]
    unreadCount: number
}

export function useGetNotifications() {
    return useServerQuery<NotificationList>({
        endpoint: API_ENDPOINTS.NOTIFICATIONS.GetNotifications.endpoint,
        method: API_ENDPOINTS.NOTIFICATIONS.GetNotifications.methods[0],
        queryKey: [API_ENDPOINTS.NOTIFICATIONS.GetNotifications.key],
        enabled: true,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    })
}
