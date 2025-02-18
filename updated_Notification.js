const container = document.getElementById("parentNotificationTemplatesInBody");
const displayedNotifications = new Set();
const readAnnouncements = new Set();
const pendingAnnouncements = new Set();
const cardMap = new Map();
const notificationIDs = new Set(); // Store all notification IDs

// Function to get URL parameters
function getQueryParamss(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// Get the 'eid' parameter from the current URL
const enrollID = getQueryParamss('eid');

function timeAgo(unixTimestamp) {
  const now = new Date();
  const date = new Date(unixTimestamp * 1000);
  const seconds = Math.floor((now - date) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + " year" + (interval > 1 ? "s" : "") + " ago";
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + " month" + (interval > 1 ? "s" : "") + " ago";
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + " day" + (interval > 1 ? "s" : "") + " ago";
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + " hour" + (interval > 1 ? "s" : "") + " ago";
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + " min" + (interval > 1 ? "s" : "") + " ago";
  return "Just now";
}

async function fetchClassIds() {
  const query = `
      query calcContacts {
           calcContacts(query: [{ where: { id: ${CONTACTss_ID} } }]) {
              ClassesID: field(arg: ["Classes", "id"])
          }
      }
  `;

  try {
      const response = await fetch(HTTP_ENDPOINT, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "Api-Key": APIii_KEY,
          },
          body: JSON.stringify({ query }),
      });

      const result = await response.json();
      console.log('Class IDs:', result);
      if (result.data && result.data.calcContacts) {
          return result.data.calcContacts.map(contact => contact.ClassesID);
      }
      return [];
  } catch (error) {
      console.error("Error fetching class IDs:", error);
      return [];
  }
}

async function initializeSocket() {
    const classIds = await fetchClassIds();

    if (classIds.length === 0) {
        console.error("No class IDs found. Cannot initialize WebSocket.");
        return;
    }

    function connect(classId) {
        const socket = new WebSocket(WS_ENDPOINT, "vitalstats");
        let keepAliveInterval;

        socket.onopen = () => {
            console.log("WebSocket connection opened.");
            keepAliveInterval = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: "KEEP_ALIVE" }));
                }
            }, 28000);

            socket.send(JSON.stringify({ type: "connection_init" }));
            socket.send(
                JSON.stringify({
                    id: "1",
                    type: "GQL_START",
                    payload: {
                        query: SUBSCRIPTION_QUERY,
                        variables: {
                            author_id: LOGGED_IN_CONTACT_ID,
                            id: LOGGED_IN_CONTACT_ID,
                            class_id: classId,
                        },
                    },
                })
            );

            fetchReadData();
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type !== "GQL_DATA") return;
            if (!data.payload || !data.payload.data) return;
            const result = data.payload.data.subscribeToCalcAnnouncements;
            if (!result) return;

            const notifications = Array.isArray(result) ? result : [result];
            notifications.forEach(notification => {
                processNotification(notification);
                notificationIDs.add(Number(notification.ID)); // Store ID
            });

            console.log("Stored Notification IDs:", [...notificationIDs]); // Debugging
        };

        socket.onclose = () => {
            console.warn(`WebSocket closed for class ID ${classId}. Retrying...`);
            clearInterval(keepAliveInterval);
            setTimeout(() => connect(classId), 2000);
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }

    classIds.forEach(connect);
}

// ✅ Create notification card
function createNotificationCard(notification, isRead) {
    const card = document.createElement("div");
    card.className = "notification-card cursor-pointer";

    card.innerHTML = `
        <div class="p-2 flex items-start gap-2 rounded justify-between notification-content w-full ${isRead ? "bg-white" : "bg-unread"}">
            <div class="flex flex-col gap-1">
                <div class="text-[#414042] text-xs font-semibold">${notification.Title}</div>
                <div class="extra-small-text text-dark">“${notification.Content}”</div>
                <div class="text-[#586A80] extra-small-text">${notification.Course_Course_Name}</div>
            </div>
            <div class="extra-small-text text-[#586A80]">${timeAgo(notification.Date_Added)}</div>
        </div>
    `;

    return card;
}

// ✅ Process and append notification
function processNotification(notification) {
  const container = document.getElementById("parentNotificationTemplatesInBody");
    const id = Number(notification.ID);
    if (displayedNotifications.has(id)) return;
    displayedNotifications.add(id);
    const isRead = readAnnouncements.has(id);
    const card = createNotificationCard(notification, isRead);
    container.appendChild(card);
    cardMap.set(id, card);
}

// ✅ Update read status UI
function updateNotificationReadStatus() {
    cardMap.forEach((card, id) => {
        if (readAnnouncements.has(id)) {
            card.querySelector(".notification-content").classList.remove("bg-unread");
            card.querySelector(".notification-content").classList.add("bg-white");
        }
    });
}

// ✅ Mark a single notification as read
function markAsRead(announcementId) {
    if (pendingAnnouncements.has(announcementId) || readAnnouncements.has(announcementId)) return;
    pendingAnnouncements.add(announcementId);

    const variables = {
        payload: {
            read_announcement_id: announcementId,
            read_contact_id: LOGGED_IN_CONTACT_ID,
        },
    };

    fetch(HTTP_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Api-Key": APIii_KEY,
        },
        body: JSON.stringify({
            query: MARK_READ_MUTATION,
            variables: variables,
        }),
    })
    .then((response) => response.json())
    .then((data) => {
        pendingAnnouncements.delete(announcementId);
        if (data.data && data.data.createOReadContactReadAnnouncement) {
            readAnnouncements.add(announcementId);
            updateNotificationReadStatus();
        }
    })
    .catch((error) => {
        pendingAnnouncements.delete(announcementId);
        console.error("Error marking notification as read:", error);
    });
}

// ✅ Mark all unread notifications as read
function markAllAsRead() {
    console.log("Marking all unread notifications as read...");

    notificationIDs.forEach(id => {
        if (!readAnnouncements.has(id) && !pendingAnnouncements.has(id)) {
            markAsRead(id);
        }
    });

    console.log("Unread notifications marked as read.");
}

// ✅ Attach event listener to your existing "Mark All Read" button
document.addEventListener("DOMContentLoaded", () => {
    const markAllBtn = document.getElementById("markEveryAsRead");
    if (markAllBtn) {
        markAllBtn.addEventListener("click", markAllAsRead);
        console.log("Mark All Read button initialized.");
    } else {
        console.warn("Button with ID 'markEveryAsRead' not found.");
    }
});

initializeSocket();
