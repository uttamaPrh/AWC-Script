const container = document.getElementById("parentNotificationTemplatesInBody");
const displayedNotifications = new Set();
const readAnnouncements = new Set();
const pendingAnnouncements = new Set();
const cardMap = new Map();
const notificationIDs = new Set(); // Store all notification IDs
const notificationData = [];

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
query calcClasses {
  calcClasses(query: [{ where: { teacher_id: ${CONTACTss_ID} } }]) {
    ID: field(arg: ["id"])
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
  
  if (result.data && result.data.calcClasses) {
      return result.data.calcClasses.map(cls => cls.ID);
  }
  return [];
} catch (error) {
  console.error("Error fetching class IDs:", error);
  return [];
}
}


async function initializeSocket() {
    const classIds = await fetchClassIds(); // Fetch all class IDs

    if (!classIds || classIds.length === 0) {
        console.error("No class IDs found. Cannot initialize WebSocket.");
        return;
    }

    

    classIds.forEach((classId) => {
        const socket = new WebSocket(WS_ENDPOINT, "vitalstats"); // ✅ Open a new WebSocket per class ID
        let keepAliveInterval;

        socket.onopen = () => {
           

            keepAliveInterval = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: "KEEP_ALIVE" }));
                }
            }, 28000);

            socket.send(JSON.stringify({ type: "connection_init" }));

            // ✅ Subscribe for EACH class ID
            socket.send(
                JSON.stringify({
                    id: `subscription_${classId}`,
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
        };

        // ✅ Make sure fetch is called for each class ID
       socket.onmessage = (event) => {
    const data = JSON.parse(event.data);


    if (data.type !== "GQL_DATA") return;
    if (!data.payload || !data.payload.data) {
      
        return;
    }

    const result = data.payload.data.subscribeToCalcAnnouncements;
    if (!result) {
       
        return;
    }

    
    const notifications = Array.isArray(result) ? result : [result];

    // ✅ Show notification if both `Post_Author_ID` & `Comment_Author_ID` are `null`
    // ✅ Hide if either matches `CONTACTss_ID`
    const filteredNotifications = notifications.filter(notification => {
        const postAuthor = notification.Post_Author_ID;
        const commentAuthor = notification.Comment_Author_ID;
        const userId = Number(CONTACTss_ID);
        
   
        if (postAuthor === userId || commentAuthor === userId){
         
          return false;
        }else{
         
        return true;}
    });

    if (filteredNotifications.length === 0) {
        console.warn(`⚠️ All notifications for Class ID ${classId} were filtered out.`);
        return;
    }

    // ✅ Process only relevant notifications
    filteredNotifications.forEach(notification => {
        processNotification(notification);
        notificationIDs.add(Number(notification.ID));
        notificationData.push(notification);
    });

    updateMarkAllReadVisibility();
};



        // ✅ Fetch read data separately for each class
        fetchReadDataForClass(classId);

        socket.onclose = () => {
            console.warn(`⚠️ WebSocket closed for Class ID ${classId}. Retrying...`);
            clearInterval(keepAliveInterval);
            setTimeout(() => initializeSocket(), 2000);
        };

        socket.onerror = (error) => {
            console.error(`❌ WebSocket error for Class ID ${classId}:`, error);
        };
    });
}

// ✅ Call once
initializeSocket();

// ✅ Create notification card
function createNotificationCard(notification, isRead) {
const card = document.createElement("div");
card.className = "notification-card cursor-pointer";
card.innerHTML = `
    <div class="p-2  items-start gap-2 rounded justify-between notification-content w-full ${isRead ? "bg-white" : "bg-unread"} ${notification.Status==="Draft" ? "hidden":"flex" }">
        <div class="flex flex-col gap-1">
            <div class="text-[#414042] text-xs font-semibold">${notification.Title}</div>
            <div class="extra-small-text text-dark line-clamp-2">“${notification.Content}”-(${notification.Class_Class_Name})</div>
            <div class="text-[#586A80] extra-small-text">${notification.Course_Course_Name}</div>
        </div>
        <div class="extra-small-text text-[#586A80] text-nowrap">${timeAgo(notification.Date_Added)}</div>
    </div>
`;
card.addEventListener("click", async function () { 
  const id = Number(notification.ID);
  const type = notification.Type;

  if (!readAnnouncements.has(id) && !pendingAnnouncements.has(id)) {
      await markAsRead(id);
  }

  if (type === 'Comment' || type === 'Post') {
      window.location.href = `https://courses.writerscentre.com.au/teacher/class/${notification.Class_Unique_ID}?selectedTab=chats`;
  } else if (type === 'Submissions') {
    openIframeModal(notification.Submissions_AWC_Teacher_s_Portal_Student_s_Submission_Details_Page_URL);
      //window.location.href = `https://courses.writerscentre.com.au/teacher/class/${notification.Class_Unique_ID}`;
  } else {
      window.location.href = `https://courses.writerscentre.com.au/teacher/class/${notification.Class_Unique_ID}?selectedTab=announcements`;
  }
});

return card;
}



function processNotification(notification) {
    const container1 = document.getElementById("parentNotificationTemplatesInBody");
    const container2 = document.getElementById("secondaryNotificationContainer"); 

    const id = Number(notification.ID);
    if (displayedNotifications.has(id)) return;
    displayedNotifications.add(id);
    
    const isRead = readAnnouncements.has(id);
    const card = createNotificationCard(notification, isRead);
    
    // ✅ Prepend to the primary container
    container1.prepend(card);
    
    let cardClone = null;

    // ✅ Prepend to the secondary container only if it exists
    if (container2) {
        cardClone = createNotificationCard(notification, isRead);
        container2.prepend(cardClone);
    }

    // ✅ Store both the original and cloned cards in cardMap (if cloned)
    cardMap.set(id, { original: card, clone: cardClone });

    // ✅ Update UI
    updateNoNotificationMessages(); 
    updateNoNotificationMessagesSec();
}



// ✅ Update read status UI
function updateNotificationReadStatus() {
    cardMap.forEach((cards, id) => {
        if (readAnnouncements.has(id)) {
            [cards.original, cards.clone].forEach((card) => {
                if (card) {
                    card.querySelector(".notification-content").classList.remove("bg-unread");
                    card.querySelector(".notification-content").classList.add("bg-white");
                }
            });
        }
    });
}

function updateMarkAllReadVisibility() {
    let hasUnread = false;
    cardMap.forEach(({ original }) => {
        if (original && original.querySelector(".notification-content").classList.contains("bg-unread")) {
            hasUnread = true;
        }
    });
    const markAllReadElements = document.querySelectorAll(".hideMarkAllReadIfAllRead");
    const redDot = document.getElementById("redDot");
    markAllReadElements.forEach(el => {
        el.classList.toggle("hidden", !hasUnread);
    });
    if (redDot) {
        redDot.classList.toggle("hidden", !hasUnread);
    }
}

// ✅ Mark a single notification as read
async function markAsRead(announcementId) {
    if (pendingAnnouncements.has(announcementId) || readAnnouncements.has(announcementId)) return;
    pendingAnnouncements.add(announcementId);

    const variables = {
        payload: {
            read_announcement_id: announcementId,
            read_contact_id: LOGGED_IN_CONTACT_ID,
        },
    };

    try {
        const response = await fetch(HTTP_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Api-Key": APIii_KEY,
            },
            body: JSON.stringify({
                query: MARK_READ_MUTATION,
                variables: variables,
            }),
        });

        const data = await response.json();
        pendingAnnouncements.delete(announcementId);
        if (data.data && data.data.createOReadContactReadAnnouncement) {
            readAnnouncements.add(announcementId);

            updateNotificationReadStatus();
            updateMarkAllReadVisibility(); 
            updateNoNotificationMessages(); 
            updateNoNotificationMessagesSec();
        }
    } catch (error) {
        pendingAnnouncements.delete(announcementId);
        console.error("❌ Error marking notification as read:", error);
    }
}




// ✅ Mark all unread notifications as read
function markAllAsRead() {
    console.log("✅ Marking all unread notifications as read...");

    let hasUnread = false;

    cardMap.forEach((cards, id) => {
        if (!readAnnouncements.has(id) && !pendingAnnouncements.has(id)) {
            hasUnread = true;
            markAsRead(id);
        }
    });

    console.log("✅ All unread notifications marked as read.");

    // ✅ Hide "Mark All Read" elements if no unread notifications exist
    updateMarkAllReadVisibility();
    updateNoNotificationMessages(); 
    updateNoNotificationMessagesSec();
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
function fetchReadDataForClass(classId) {
    console.log(`🔍 Fetching read data for Class ID: ${classId}`);
    
    fetch(HTTP_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Api-Key": APIii_KEY,
        },
        body: JSON.stringify({
            query: READ_QUERY,
            variables: { class_id: classId }
        }),
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
            updateNoNotificationMessages(); 
            updateNoNotificationMessagesSec();
        }
    })
    .catch((error) => {
        console.error(`❌ Error fetching read data for Class ID ${classId}:`, error);
    });
}

function updateNoNotificationMessages() {
    const noAllMessage = document.getElementById("noAllMessage");
    const noAnnouncementsMessage = document.getElementById("noAnnouncementsMessage");
    if (!noAllMessage || !noAnnouncementsMessage) return; // Ensure elements exist

    const visibleCards = [...cardMap.values()].filter(({ original }) => 
        original && !original.classList.contains("hidden")
    );
    const hasNotifications = visibleCards.length > 0;
    noAllMessage.classList.toggle("hidden", hasNotifications);
    noAnnouncementsMessage.classList.add("hidden");
}


// ✅ Also move this function outside DOMContentLoaded
function updateNoNotificationMessagesSec() {
    const noAllMessageSec = document.getElementById("noAllMessageSec");
    const noAnnouncementsMessageSec = document.getElementById("noAnnouncementsMessageSec");
    if (!noAllMessageSec || !noAnnouncementsMessageSec) return; // Ensure elements exist
    const hasVisible = [...cardMap.values()].some(({ clone }) =>  clone && !clone.classList.contains("hidden")
    );
    noAllMessageSec.classList.toggle("hidden", hasVisible);
    noAnnouncementsMessageSec.classList.add("hidden");
}

// ✅ Filter announcements only
document.addEventListener("DOMContentLoaded", function () {
    const onlySeeBtn = document.getElementById("OnlyseeAnnouncements");
    const noAllMessage = document.getElementById("noAllMessage");
    const showAllBtn = document.getElementById("allAnnouncements");
    const noAnnouncementsMessage = document.getElementById("noAnnouncementsMessage");
    const showUnreadAnnounceBtn = document.getElementById("showUnreadAnnouncement");
    const showUnreadAllNotification = document.getElementById("showUnreadAllNotification");

    let showUnreadMode = false;
    let showUnreadAllMode = false;

   

   function toggleVisibilityAll() {
    let hasData = false;

    showUnreadAllMode = false;
    showUnreadMode = false;

    cardMap.forEach(({ original }) => {
        if (original) {
            original.classList.remove("hidden");
            hasData = true; // ✅ Mark as having data
        }
    });

    // ✅ Hide "No Announcements" message, only show "No Messages" if no notifications exist
    noAllMessage.classList.toggle("hidden", hasData);
    noAnnouncementsMessage.classList.add("hidden"); // Hide announcement message when viewing all
}

function toggleVisibilityByType(type) {
    let hasAnnouncements = false;

    showUnreadAllMode = false;
    showUnreadMode = false;

    cardMap.forEach(({ original }, id) => {
        const notification = notificationData.find(n => Number(n.ID) === id);
        if (!notification) return;

        const shouldShow = notification.Type === type;
        if (original) {
            original.classList.toggle("hidden", !shouldShow);
        }

        if (shouldShow) hasAnnouncements = true;
    });

    // ✅ Hide "No Messages" when viewing announcements, only show "No Announcements" if empty
    noAnnouncementsMessage.classList.toggle("hidden", hasAnnouncements);
    noAllMessage.classList.add("hidden"); // Hide general "No Messages" when viewing only announcements
}

function toggleUnreadAnnouncements() {
    showUnreadMode = !showUnreadMode;
    let hasUnread = false;
    let hasVisible = false;

    cardMap.forEach(({ original }, id) => {
        const notification = notificationData.find(n => Number(n.ID) === id);
        if (!notification) return;

        if (notification.Type === "Announcement") {
            const isUnread = original.querySelector(".notification-content").classList.contains("bg-unread");

            if (original) {
                original.classList.toggle("hidden", showUnreadMode && !isUnread);
                if (!original.classList.contains("hidden")) {
                    hasVisible = true;
                }
            }

            if (isUnread) hasUnread = true;
        }
    });

    // ✅ Show/Hide "No Announcements" correctly
    noAnnouncementsMessage.classList.toggle("hidden", hasVisible);
    noAllMessage.classList.add("hidden"); // Hide general "No Messages" when viewing announcements
}

function toggleUnreadNotifications() {
    showUnreadAllMode = !showUnreadAllMode;
    let hasUnread = false;
    let hasVisible = false;

    cardMap.forEach(({ original }) => {
        const isUnread = original.querySelector(".notification-content").classList.contains("bg-unread");

        if (original) {
            original.classList.toggle("hidden", showUnreadAllMode && !isUnread);
            if (!original.classList.contains("hidden")) {
                hasVisible = true;
            }
        }

        if (isUnread) hasUnread = true;
    });

    // ✅ Show/Hide "No Messages" correctly
    noAllMessage.classList.toggle("hidden", hasVisible);
    noAnnouncementsMessage.classList.add("hidden"); // Hide "No Announcements" when viewing all
}



    onlySeeBtn.addEventListener("click", () => toggleVisibilityByType("Announcement"));
    showAllBtn.addEventListener("click", toggleVisibilityAll);
    showUnreadAnnounceBtn.addEventListener("click", toggleUnreadAnnouncements);
    showUnreadAllNotification.addEventListener("click", toggleUnreadNotifications);
});



//for View All Notification
document.addEventListener("DOMContentLoaded", function () {
    const onlySeeBtnSec = document.getElementById("OnlyseeAnnouncementsSec");
    const noAllMessageSec = document.getElementById("noAllMessageSec");
    const showAllBtnSec = document.getElementById("allAnnouncementsSec");
    const noAnnouncementsMessageSec = document.getElementById("noAnnouncementsMessageSec");
    const showUnreadAnnounceBtnSec = document.getElementById("showUnreadAnnouncementSec");
    const showUnreadAllNotificationSec = document.getElementById("showUnreadAllNotificationSec");

    let showUnreadModeSec = false;
    let showUnreadAllModeSec = false;

    // ✅ Function to check if notifications are visible and update the "No Messages" display
    // function updateNoNotificationMessagesSec() {
    //     const hasVisible = [...cardMap.values()].some(({ clone }) => clone && !clone.classList.contains("hidden"));

    //     noAllMessageSec.classList.toggle("hidden", hasVisible);
    //     noAnnouncementsMessageSec.classList.toggle("hidden", hasVisible);
    // }

    // ✅ Show only Announcements (Secondary)
    function toggleVisibilityByTypeSec(type) {
        let hasAnnouncements = false;

        showUnreadAllModeSec = false;
        showUnreadModeSec = false;

        cardMap.forEach(({ clone }, id) => {
            const notification = notificationData.find(n => Number(n.ID) === id);
            if (!notification) return;

            const shouldShow = notification.Type === type;
            if (clone) {
                clone.classList.toggle("hidden", !shouldShow);
            }

            if (shouldShow) hasAnnouncements = true;
        });

        // ✅ Correctly toggle "No Announcements" message
        noAnnouncementsMessageSec.classList.toggle("hidden", hasAnnouncements);
        noAllMessageSec.classList.add("hidden"); // Hide "No Messages" when viewing announcements
    }

    // ✅ Show all notifications (Secondary)
    function toggleVisibilityAllSec() {
        let hasData = false;

        showUnreadAllModeSec = false;
        showUnreadModeSec = false;

        cardMap.forEach(({ clone }) => {
            if (clone) {
                clone.classList.remove("hidden");
                hasData = true;
            }
        });

        // ✅ Correctly toggle "No Messages" message
        noAllMessageSec.classList.toggle("hidden", hasData);
        noAnnouncementsMessageSec.classList.add("hidden"); // Hide "No Announcements" when viewing all
    }

    // ✅ Toggle Unread Announcements (Secondary)
    function toggleUnreadAnnouncementsSec() {
        showUnreadModeSec = !showUnreadModeSec;
        let hasUnread = false;
        let hasVisible = false;

        cardMap.forEach(({ clone }, id) => {
            const notification = notificationData.find(n => Number(n.ID) === id);
            if (!notification) return;

            if (notification.Type === "Announcement") {
                const isUnread = clone?.querySelector(".notification-content")?.classList.contains("bg-unread");

                if (clone) {
                    clone.classList.toggle("hidden", showUnreadModeSec && !isUnread);
                    if (!clone.classList.contains("hidden")) {
                        hasVisible = true;
                    }
                }

                if (isUnread) hasUnread = true;
            }
        });

        // ✅ Correctly toggle "No Announcements" message
        noAnnouncementsMessageSec.classList.toggle("hidden", hasVisible);
        noAllMessageSec.classList.add("hidden"); // Hide "No Messages" when viewing announcements
    }

    // ✅ Toggle Unread Notifications (Secondary)
    function toggleUnreadNotificationsSec() {
        showUnreadAllModeSec = !showUnreadAllModeSec;
        let hasUnread = false;
        let hasVisible = false;

        cardMap.forEach(({ clone }) => {
            const isUnread = clone?.querySelector(".notification-content")?.classList.contains("bg-unread");

            if (clone) {
                clone.classList.toggle("hidden", showUnreadAllModeSec && !isUnread);
                if (!clone.classList.contains("hidden")) {
                    hasVisible = true;
                }
            }

            if (isUnread) hasUnread = true;
        });

        // ✅ Correctly toggle "No Messages" message
        noAllMessageSec.classList.toggle("hidden", hasVisible);
        noAnnouncementsMessageSec.classList.add("hidden"); 
    }


if (onlySeeBtnSec) {
        onlySeeBtnSec.addEventListener("click", () => toggleVisibilityByTypeSec("Announcement"));
    }
    if (showAllBtnSec) {
        showAllBtnSec.addEventListener("click", toggleVisibilityAllSec);
    }
    if (showUnreadAnnounceBtnSec) {
        showUnreadAnnounceBtnSec.addEventListener("click", toggleUnreadAnnouncementsSec);
    }
    if (showUnreadAllNotificationSec) {
        showUnreadAllNotificationSec.addEventListener("click", toggleUnreadNotificationsSec);
    }
  
});

document.addEventListener("DOMContentLoaded", function () {
    updateMarkAllReadVisibility(); // ✅ Check on page load
    updateNoNotificationMessages(); 
    updateNoNotificationMessagesSec();
});


initializeSocket();


function updateNoNotificationMessages() {
    const noAllMessage = document.getElementById("noAllMessage");
    const noAnnouncementsMessage = document.getElementById("noAnnouncementsMessage");
    if (!noAllMessage || !noAnnouncementsMessage) return; // Ensure elements exist

    const visibleCards = [...cardMap.values()].filter(({ original }) => 
        original && !original.classList.contains("hidden")
    );
    const hasNotifications = visibleCards.length > 0;
    noAllMessage.classList.toggle("hidden", hasNotifications);
    noAnnouncementsMessage.classList.add("hidden");
}


// ✅ Also move this function outside DOMContentLoaded
function updateNoNotificationMessagesSec() {
    const noAllMessageSec = document.getElementById("noAllMessageSec");
    const noAnnouncementsMessageSec = document.getElementById("noAnnouncementsMessageSec");
    if (!noAllMessageSec || !noAnnouncementsMessageSec) return; // Ensure elements exist
    const hasVisible = [...cardMap.values()].some(({ clone }) =>  clone && !clone.classList.contains("hidden")
    );
    noAllMessageSec.classList.toggle("hidden", hasVisible);
    noAnnouncementsMessageSec.classList.add("hidden");
}

// ✅ Filter announcements only
document.addEventListener("DOMContentLoaded", function () {
    const onlySeeBtn = document.getElementById("OnlyseeAnnouncements");
    const noAllMessage = document.getElementById("noAllMessage");
    const showAllBtn = document.getElementById("allAnnouncements");
    const noAnnouncementsMessage = document.getElementById("noAnnouncementsMessage");
    const showUnreadAnnounceBtn = document.getElementById("showUnreadAnnouncement");
    const showUnreadAllNotification = document.getElementById("showUnreadAllNotification");

    let showUnreadMode = false;
    let showUnreadAllMode = false;

    //function updateNoNotificationMessages() {
     //   const visibleCards = [...cardMap.values()].filter(({ original }) => original && !original.classList.contains("hidden"));
     //   noAllMessage.classList.toggle("hidden", visibleCards.length > 0);
     //   noAnnouncementsMessage.classList.toggle("hidden", visibleCards.length > 0);
    //}

   function toggleVisibilityAll() {
    let hasData = false;

    showUnreadAllMode = false;
    showUnreadMode = false;

    cardMap.forEach(({ original }) => {
        if (original) {
            original.classList.remove("hidden");
            hasData = true; // ✅ Mark as having data
        }
    });

    // ✅ Hide "No Announcements" message, only show "No Messages" if no notifications exist
    noAllMessage.classList.toggle("hidden", hasData);
    noAnnouncementsMessage.classList.add("hidden"); // Hide announcement message when viewing all
}

function toggleVisibilityByType(type) {
    let hasAnnouncements = false;

    showUnreadAllMode = false;
    showUnreadMode = false;

    cardMap.forEach(({ original }, id) => {
        const notification = notificationData.find(n => Number(n.ID) === id);
        if (!notification) return;

        const shouldShow = notification.Type === type;
        if (original) {
            original.classList.toggle("hidden", !shouldShow);
        }

        if (shouldShow) hasAnnouncements = true;
    });

    // ✅ Hide "No Messages" when viewing announcements, only show "No Announcements" if empty
    noAnnouncementsMessage.classList.toggle("hidden", hasAnnouncements);
    noAllMessage.classList.add("hidden"); // Hide general "No Messages" when viewing only announcements
}

function toggleUnreadAnnouncements() {
    showUnreadMode = !showUnreadMode;
    let hasUnread = false;
    let hasVisible = false;

    cardMap.forEach(({ original }, id) => {
        const notification = notificationData.find(n => Number(n.ID) === id);
        if (!notification) return;

        if (notification.Type === "Announcement") {
            const isUnread = original.querySelector(".notification-content").classList.contains("bg-unread");

            if (original) {
                original.classList.toggle("hidden", showUnreadMode && !isUnread);
                if (!original.classList.contains("hidden")) {
                    hasVisible = true;
                }
            }

            if (isUnread) hasUnread = true;
        }
    });

    // ✅ Show/Hide "No Announcements" correctly
    noAnnouncementsMessage.classList.toggle("hidden", hasVisible);
    noAllMessage.classList.add("hidden"); // Hide general "No Messages" when viewing announcements
}

function toggleUnreadNotifications() {
    showUnreadAllMode = !showUnreadAllMode;
    let hasUnread = false;
    let hasVisible = false;

    cardMap.forEach(({ original }) => {
        const isUnread = original.querySelector(".notification-content").classList.contains("bg-unread");

        if (original) {
            original.classList.toggle("hidden", showUnreadAllMode && !isUnread);
            if (!original.classList.contains("hidden")) {
                hasVisible = true;
            }
        }

        if (isUnread) hasUnread = true;
    });

    // ✅ Show/Hide "No Messages" correctly
    noAllMessage.classList.toggle("hidden", hasVisible);
    noAnnouncementsMessage.classList.add("hidden"); // Hide "No Announcements" when viewing all
}



    onlySeeBtn.addEventListener("click", () => toggleVisibilityByType("Announcement"));
    showAllBtn.addEventListener("click", toggleVisibilityAll);
    showUnreadAnnounceBtn.addEventListener("click", toggleUnreadAnnouncements);
    showUnreadAllNotification.addEventListener("click", toggleUnreadNotifications);
});



//for View All Notification
document.addEventListener("DOMContentLoaded", function () {
    const onlySeeBtnSec = document.getElementById("OnlyseeAnnouncementsSec");
    const noAllMessageSec = document.getElementById("noAllMessageSec");
    const showAllBtnSec = document.getElementById("allAnnouncementsSec");
    const noAnnouncementsMessageSec = document.getElementById("noAnnouncementsMessageSec");
    const showUnreadAnnounceBtnSec = document.getElementById("showUnreadAnnouncementSec");
    const showUnreadAllNotificationSec = document.getElementById("showUnreadAllNotificationSec");

    let showUnreadModeSec = false;
    let showUnreadAllModeSec = false;

    // ✅ Function to check if notifications are visible and update the "No Messages" display
    // function updateNoNotificationMessagesSec() {
    //     const hasVisible = [...cardMap.values()].some(({ clone }) => clone && !clone.classList.contains("hidden"));

    //     noAllMessageSec.classList.toggle("hidden", hasVisible);
    //     noAnnouncementsMessageSec.classList.toggle("hidden", hasVisible);
    // }

    // ✅ Show only Announcements (Secondary)
    function toggleVisibilityByTypeSec(type) {
        let hasAnnouncements = false;

        showUnreadAllModeSec = false;
        showUnreadModeSec = false;

        cardMap.forEach(({ clone }, id) => {
            const notification = notificationData.find(n => Number(n.ID) === id);
            if (!notification) return;

            const shouldShow = notification.Type === type;
            if (clone) {
                clone.classList.toggle("hidden", !shouldShow);
            }

            if (shouldShow) hasAnnouncements = true;
        });

        // ✅ Correctly toggle "No Announcements" message
        noAnnouncementsMessageSec.classList.toggle("hidden", hasAnnouncements);
        noAllMessageSec.classList.add("hidden"); // Hide "No Messages" when viewing announcements
    }

    // ✅ Show all notifications (Secondary)
    function toggleVisibilityAllSec() {
        let hasData = false;

        showUnreadAllModeSec = false;
        showUnreadModeSec = false;

        cardMap.forEach(({ clone }) => {
            if (clone) {
                clone.classList.remove("hidden");
                hasData = true;
            }
        });

        // ✅ Correctly toggle "No Messages" message
        noAllMessageSec.classList.toggle("hidden", hasData);
        noAnnouncementsMessageSec.classList.add("hidden"); // Hide "No Announcements" when viewing all
    }

    // ✅ Toggle Unread Announcements (Secondary)
    function toggleUnreadAnnouncementsSec() {
        showUnreadModeSec = !showUnreadModeSec;
        let hasUnread = false;
        let hasVisible = false;

        cardMap.forEach(({ clone }, id) => {
            const notification = notificationData.find(n => Number(n.ID) === id);
            if (!notification) return;

            if (notification.Type === "Announcement") {
                const isUnread = clone?.querySelector(".notification-content")?.classList.contains("bg-unread");

                if (clone) {
                    clone.classList.toggle("hidden", showUnreadModeSec && !isUnread);
                    if (!clone.classList.contains("hidden")) {
                        hasVisible = true;
                    }
                }

                if (isUnread) hasUnread = true;
            }
        });

        // ✅ Correctly toggle "No Announcements" message
        noAnnouncementsMessageSec.classList.toggle("hidden", hasVisible);
        noAllMessageSec.classList.add("hidden"); // Hide "No Messages" when viewing announcements
    }

    // ✅ Toggle Unread Notifications (Secondary)
    function toggleUnreadNotificationsSec() {
        showUnreadAllModeSec = !showUnreadAllModeSec;
        let hasUnread = false;
        let hasVisible = false;

        cardMap.forEach(({ clone }) => {
            const isUnread = clone?.querySelector(".notification-content")?.classList.contains("bg-unread");

            if (clone) {
                clone.classList.toggle("hidden", showUnreadAllModeSec && !isUnread);
                if (!clone.classList.contains("hidden")) {
                    hasVisible = true;
                }
            }

            if (isUnread) hasUnread = true;
        });

        // ✅ Correctly toggle "No Messages" message
        noAllMessageSec.classList.toggle("hidden", hasVisible);
        noAnnouncementsMessageSec.classList.add("hidden"); // Hide "No Announcements" when viewing all
    }

    // ✅ Attach event listeners for Secondary filtering
    // onlySeeBtnSec.addEventListener("click", () => toggleVisibilityByTypeSec("Announcement"));
    // showAllBtnSec.addEventListener("click", toggleVisibilityAllSec);
    // showUnreadAnnounceBtnSec.addEventListener("click", toggleUnreadAnnouncementsSec);
    // showUnreadAllNotificationSec.addEventListener("click", toggleUnreadNotificationsSec);

if (onlySeeBtnSec) {
        onlySeeBtnSec.addEventListener("click", () => toggleVisibilityByTypeSec("Announcement"));
    }
    if (showAllBtnSec) {
        showAllBtnSec.addEventListener("click", toggleVisibilityAllSec);
    }
    if (showUnreadAnnounceBtnSec) {
        showUnreadAnnounceBtnSec.addEventListener("click", toggleUnreadAnnouncementsSec);
    }
    if (showUnreadAllNotificationSec) {
        showUnreadAllNotificationSec.addEventListener("click", toggleUnreadNotificationsSec);
    }
  
});

document.addEventListener("DOMContentLoaded", function () {
    updateMarkAllReadVisibility(); // ✅ Check on page load
    updateNoNotificationMessages(); 
    updateNoNotificationMessagesSec();
});


initializeSocket();
