const container = document.getElementById("parentNotificationTemplatesInBody");
const displayedNotifications = new Set();
const readAnnouncements = new Set();
const pendingAnnouncements = new Set();
const cardMap = new Map();

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

    let socket;
    let keepAliveInterval;

    function sendKeepAlive() {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "KEEP_ALIVE" }));
        }
    }

    function connect(classId) {
        socket = new WebSocket(WS_ENDPOINT, "vitalstats");

        socket.onopen = () => {
            console.log("WebSocket connection opened.");
            keepAliveInterval = setInterval(sendKeepAlive, 28000);

            // Ensure the connection is open before sending data
            if (socket.readyState === WebSocket.OPEN) {
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
            } else {
                console.warn("WebSocket not ready. Retrying in 500ms...");
                setTimeout(() => {
                    if (socket.readyState === WebSocket.OPEN) {
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
                    } else {
                        console.error("WebSocket failed to open in time.");
                    }
                }, 500); 
            }
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type !== "GQL_DATA") return;
            if (!data.payload || !data.payload.data) return;
            const result = data.payload.data.subscribeToCalcAnnouncements;
            if (!result) return;
            const notifications = Array.isArray(result) ? result : [result];
            notifications.forEach(processNotification);
        };

        socket.onclose = () => {
            console.log("WebSocket closed. Clearing keep-alive interval.");
            clearInterval(keepAliveInterval);
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }

    // Connect to WebSocket for each class ID
    classIds.forEach(connect);
}


// Function to create notification card
function createNotificationCard(notification, isRead) {
const card = document.createElement("div");
card.className = "notification-card cursor-pointer";

for (const key in notification) {
    if (Object.prototype.hasOwnProperty.call(notification, key)) {
        card.setAttribute(`data-${key.toLowerCase()}`, notification[key]);
    }
}

card.innerHTML = `
  <div class="p-2 flex items-start gap-2 rounded justify-between notification-content w-full ${isRead ? "bg-white" : "bg-unread"}">
    <div class="flex flex-col gap-1">
      <div class="text-[#414042] text-xs font-semibold font-['Open Sans'] leading-none">${notification.Title}</div>
      <div class="extra-small-text text-dark">“${notification.Content}”</div>
      <div class="text-[#586A80] extra-small-text">${notification.Course_Course_Name}</div>
    </div>
    <div class="extra-small-text text-[#586A80]">${timeAgo(notification.Date_Added)}</div>
  </div>
`;

card.addEventListener("click", async function () { 
  const id = Number(notification.ID);
  const type = notification.Type;

  if (!readAnnouncements.has(id) && !pendingAnnouncements.has(id)) {
      await markAsRead(id); 
  }

  if (type === 'Comment' || type === 'Post') {
      window.location.href = `https://courses.writerscentre.com.au/students/course-details/${notification.Course_Unique_ID}?eid=${enrollID}&selectedTab=courseChat`;
  } else if (type === 'Submissions') {
      window.location.href = `https://courses.writerscentre.com.au/course-details/content/${notification.Lesson_Unique_ID1}?eid=${enrollID}`;
  } else {
      window.location.href = `https://courses.writerscentre.com.au/students/course-details/${notification.Course_Unique_ID}?eid=${enrollID}&selectedTab=anouncemnt`;
  }
});

return card;
}

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

function updateNotificationReadStatus() {
cardMap.forEach((card, id) => {
    if (readAnnouncements.has(id)) {
        card.querySelector(".notification-content").classList.remove("bg-unread");
    } else {
        card.querySelector(".notification-content").classList.add("bg-white");
    }
});
}

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

function fetchReadData() {
fetch(HTTP_ENDPOINT, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Api-Key": APIii_KEY,
    },
    body: JSON.stringify({ query: READ_QUERY }),
})
.then((response) => response.json())
.then((data) => {
    if (data.data && data.data.calcOReadContactReadAnnouncements) {
        const records = Array.isArray(data.data.calcOReadContactReadAnnouncements)
            ? data.data.calcOReadContactReadAnnouncements
            : [data.data.calcOReadContactReadAnnouncements];
        records.forEach((record) => {
            if (Number(record.Read_Contact_ID) === Number(LOGGED_IN_CONTACT_ID)) {
                readAnnouncements.add(Number(record.Read_Announcement_ID));
            }
        });
        updateNotificationReadStatus();
    }
})
.catch((error) => {
    console.error("Error fetching read data:", error);
});
}

initializeSocket();
