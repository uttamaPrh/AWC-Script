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
            notifications.forEach(processNotification);
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

        const baseUrl = `https://courses.writerscentre.com.au/students/course-details/${notification.Course_Unique_ID}?eid=${enrollID}`;
        window.location.href = type === 'Comment' || type === 'Post' ? `${baseUrl}&selectedTab=courseChat`
                                : type === 'Submissions' ? `https://courses.writerscentre.com.au/course-details/content/${notification.Lesson_Unique_ID1}?eid=${enrollID}`
                                : `${baseUrl}&selectedTab=anouncemnt`;
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
            updateNotificationReadStatus();
        }
    } catch (error) {
        console.error("Error fetching read data:", error);
    }
}

initializeSocket();
