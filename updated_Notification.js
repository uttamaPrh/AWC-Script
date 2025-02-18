const container = document.getElementById("parentNotificationTemplatesInBody");
const displayedNotifications = new Set();
const readAnnouncements = new Set();
const pendingAnnouncements = new Set();
const cardMap = new Map();
const notificationIDs = new Set(); // Store all notification IDs

// Function to get URL parameters safely
function getQueryParamss(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param) || ""; // Return an empty string if null
}

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
        query calcEnrolments {
            calcEnrolments(query: [{ where: { student_id: ${CONTACTss_ID} } }]) {
                Class_ID: field(arg: ["class_id"])
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

        if (result.data && result.data.calcEnrolments) {
            return result.data.calcEnrolments.map(enrolment => enrolment.Class_ID);
        }
        return [];
    } catch (error) {
        console.error("Error fetching class IDs:", error);
        return [];
    }
}

// ✅ Function to mark all unread notifications as read
function markAllAsRead() {
    console.log("Marking all unread notifications as read...");

    notificationIDs.forEach(id => {
        if (!readAnnouncements.has(id) && !pendingAnnouncements.has(id)) {
            markAsRead(id); // Only mark unread notifications
        }
    });

    console.log("Unread notifications marked as read.");
}

// ✅ Attach event listener to your existing "Mark All Read" button
document.addEventListener("DOMContentLoaded", () => {
    const markAllBtn = document.getElementById("markEveryAsRead"); // Your existing button
    if (markAllBtn) {
        markAllBtn.addEventListener("click", markAllAsRead);
        console.log("Mark All Read button initialized.");
    } else {
        console.warn("Button with ID 'markEveryAsRead' not found.");
    }
});

async function initializeSocket() {
    const classIds = await fetchClassIds();

    if (classIds.length === 0) {
        console.error("No class IDs found. Cannot initialize WebSocket.");
        return;
    }

    function connect(classId, attempt = 1) {
        const socket = new WebSocket(WS_ENDPOINT, "vitalstats");
        let keepAliveInterval;

        socket.onopen = () => {
            console.log(`WebSocket connection opened for class ID ${classId}.`);
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
                notificationIDs.add(Number(notification.ID)); // Store notification ID
            });

            console.log("Stored Notification IDs:", [...notificationIDs]); // Debugging
        };

        socket.onclose = () => {
            console.warn(`WebSocket closed for class ID ${classId}. Retrying...`);
            clearInterval(keepAliveInterval);

            const retryDelay = Math.min(500 * Math.pow(2, attempt), 10000);
            setTimeout(() => {
                console.log(`Retrying WebSocket connection (Attempt ${attempt + 1})...`);
                connect(classId, attempt + 1);
            }, retryDelay);
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }

    classIds.forEach(classId => connect(classId));
}

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

async function fetchReadData() {
    try {
        const response = await fetch(HTTP_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Api-Key": APIii_KEY,
            },
            body: JSON.stringify({ query: READ_QUERY }),
        });

        const data = await response.json();
        if (data.data?.calcOReadContactReadAnnouncements) {
            data.data.calcOReadContactReadAnnouncements.forEach(record => {
                if (Number(record.Read_Contact_ID) === Number(LOGGED_IN_CONTACT_ID)) {
                    readAnnouncements.add(Number(record.Read_Announcement_ID));
                }
            });
        }
    } catch (error) {
        console.error("Error fetching read data:", error);
    }
}

initializeSocket();
