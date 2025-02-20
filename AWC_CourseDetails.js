  //Script for tab
  const overviewElements = document.querySelectorAll('.overview');
  overviewElements.forEach((overviewElement) => {
    overviewElement.setAttribute('x-show', "selectedTab === 'overview'");
    overviewElement.setAttribute('id', 'tabpanelOverview');
    overviewElement.setAttribute('role', 'tabpanel');
    overviewElement.setAttribute('aria-label', 'overview');
  });
     const announcemnetElements = document.querySelectorAll('.anouncemnt');
  announcemnetElements.forEach((anouncemntElement) => {
    anouncemntElement.setAttribute('x-show', "selectedTab === 'anouncemnt'");
    anouncemntElement.setAttribute('id', 'tabpanelanouncemnt');
    anouncemntElement.setAttribute('role', 'tabpanel');
    anouncemntElement.setAttribute('aria-label', 'anouncemnt');
  });
  const courseChatElements = document.querySelectorAll('.courseChat');
  courseChatElements.forEach((courseChatElement) => {
    courseChatElement.setAttribute('x-show', "selectedTab === 'courseChat'");
    courseChatElement.setAttribute('id', 'tabpanelCourseChat');
    courseChatElement.setAttribute('role', 'tabpanel');
    courseChatElement.setAttribute('aria-label', 'courseChat');
  });

  const contentElements = document.querySelectorAll('.content');
  contentElements.forEach((contentElement) => {
    contentElement.setAttribute('x-show', "selectedTab === 'content'");
    contentElement.setAttribute('id', 'tabpanelContent');
    contentElement.setAttribute('role', 'tabpanel');
    contentElement.setAttribute('aria-label', 'content');
  });

  const progressElements = document.querySelectorAll('.courseProgress');
  progressElements.forEach((progressElement) => {
    progressElement.setAttribute('x-show', "selectedTab === 'progress'");
    progressElement.setAttribute('id', 'tabpanelProgress');
    progressElement.setAttribute('role', 'tabpanel');
    progressElement.setAttribute('aria-label', 'progress');
  });

  // Set attributes for nested tabs (allPosts, myPosts, announcements) that only work inside courseChat
  const allPostsElements = document.querySelectorAll('.allPosts');
  allPostsElements.forEach((allPostsElement) => {
    allPostsElement.setAttribute('x-show', "selectedTab === 'courseChat' && postTabs === 'allPosts'");
    allPostsElement.setAttribute('id', 'tabpanelAllPosts');
    allPostsElement.setAttribute('role', 'tabpanel');
    allPostsElement.setAttribute('aria-label', 'all posts');
  });

  const myPostsElements = document.querySelectorAll('.myPosts');
  myPostsElements.forEach((myPostsElement) => {
    myPostsElement.setAttribute('x-show', "selectedTab === 'courseChat' && postTabs === 'myPosts'");
    myPostsElement.setAttribute('id', 'tabpanelMyPosts');
    myPostsElement.setAttribute('role', 'tabpanel');
    myPostsElement.setAttribute('aria-label', 'my posts');
  });

  const announcementsElements = document.querySelectorAll('.announcements');
  announcementsElements.forEach((announcementsElement) => {
    announcementsElement.setAttribute('x-show', "selectedTab === 'courseChat' && postTabs === 'announcements'");
    announcementsElement.setAttribute('id', 'tabpanelAnnouncements');
    announcementsElement.setAttribute('role', 'tabpanel');
    announcementsElement.setAttribute('aria-label', 'announcements');
  });

const API_KEY = "mMzQezxyIwbtSc85rFPs3";
const GRAPHQL_ENDPOINT = "https://awc.vitalstats.app/api/v1/graphql";
const studentID = 50;

// Function to fetch GraphQL Data
async function fetchGraphQL(query) {
    try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Api-Key": API_KEY
            },
            body: JSON.stringify({ query })
        });

        const result = await response.json();
        return result?.data || {}; 
    } catch (error) {
        console.error("Error fetching data:", error);
        return {};
    }
}

// Function to convert Unix timestamp to readable date format
function formatDate(unixTimestamp) {
    if (!unixTimestamp) return "Invalid Date";
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
}

// Function to calculate the open date based on weeks from Start_Date_Unix
function calculateOpenDate(startDateUnix, weeks) {
    if (!startDateUnix) return "No Start Date";
    if (weeks === 0 || weeks === null) {
        return "Unlocked";
    }
    const openDateUnix = startDateUnix + (weeks * 7 * 24 * 60 * 60);
    return `Unlocks in ${formatDate(openDateUnix)}`;
}

function isOpenDateValid(startDateUnix, weeks) {
    if (!startDateUnix) return false;
    if (weeks === 0 || weeks === null) return true; // Unlocked case

    const openDateUnix = startDateUnix + (weeks * 7 * 24 * 60 * 60);
    const todayUnix = Math.floor(Date.now() / 1000); // Get today's date in Unix timestamp

    return openDateUnix >= todayUnix;
}
// Function to fetch lesson statuses
async function fetchLessonStatuses() {
    const completedLessons = await fetchGraphQL(completedQuery);
    const inProgressLessons = await fetchGraphQL(inProgressQuery);

    console.log("Completed Lessons Data:", completedLessons);
    console.log("InProgress Lessons Data:", inProgressLessons);

    const completedSet = new Set(
        completedLessons?.calcOEnrolmentLessonCompletionLessonCompletions?.map(lesson => Number(lesson.Lesson_Completion_ID)) || []
    );
    const inProgressSet = new Set(
        inProgressLessons?.calcOLessonInProgressLessonEnrolmentinProgresses?.map(lesson => Number(lesson.Lesson_In_Progress_ID)) || []
    );

    console.log("Completed Set:", completedSet);
    console.log("InProgress Set:", inProgressSet);

    return { completedSet, inProgressSet };
}

// Merge Modules with Lessons and Sort by Order
async function combineModulesAndLessons() {
    const modulesResponse = await fetchGraphQL(getModulesQuery);
    const lessonsResponse = await fetchGraphQL(getLessonsQuery);
    const lessonStatuses = await fetchLessonStatuses(studentID);

    console.log("Modules Raw Data:", modulesResponse);
    console.log("Lessons Raw Data:", lessonsResponse);

    const modules = modulesResponse?.calcModules || [];
    const lessonsData = lessonsResponse?.calcModules || [];

    if (!Array.isArray(modules)) {
        console.error("Modules is not an array:", modules);
        return [];
    }
    if (!Array.isArray(lessonsData)) {
        console.error("Lessons Data is not an array:", lessonsData);
        return [];
    }

    console.log("Modules Data:", modules);
    console.log("Lessons Data:", lessonsData);

    const modulesMap = {};

    // Initialize modules and ensure an empty Lessons array
    modules.forEach(module => {
        const openDateText = calculateOpenDate(module.Class_Start_Date, module.Week_Open_from_Start_Date);
        const isAvailable = isOpenDateValid(module.Class_Start_Date, module.Week_Open_from_Start_Date);
        console.log("Is Open Date Valid:", isAvailable);
        modulesMap[module.ID] = {
            ...module,
            Lessons: [],
            Open_Date_Text: openDateText,
            isAvailable:isAvailable
        };
    });

    // Create a set to track unique LessonsID
    const uniqueLessonsSet = new Set();

    lessonsData.forEach(lesson => {
        let moduleId = lesson.ID || lesson.LessonsID;
        if (modulesMap[moduleId]) {
            if (lesson.Lessons_Lesson_Name && !uniqueLessonsSet.has(lesson.LessonsID)) {
                uniqueLessonsSet.add(lesson.LessonsID); 

                let status = "NotStarted"; 
                const lessonID = lesson.LessonsID; 
                const isCompleted = lessonStatuses.completedSet.has(lessonID);
                const isInProgress = lessonStatuses.inProgressSet.has(lessonID);

                if (isCompleted && isInProgress) {
                    status = "Completed"; 
                } else if (isInProgress && !isCompleted) {
                    status = "InProgress"; 
                }else if (isCompleted && !isInProgress) {
                    status = "Completed"; 
                }else{
                status="NotStarted";
                }

                modulesMap[moduleId].Lessons.push({
                    ...lesson, 
                    Lesson_Name: lesson.Lessons_Lesson_Name,
                    LessonsType: lesson.LessonsType,
                    Lesson_AWC_Lesson_Content_Page_URL: lesson.Lesson_AWC_Lesson_Content_Page_URL,
                    Lesson_Length_in_Hour: lesson.Lessons_Lesson_Length_in_Hour,
                    Lesson_Length_in_Minute: lesson.Lesson_Lesson_Length_in_Minute,
                    Lesson_Length_in_Second: lesson.Lessons_Lesson_Length_in_Second,
                    Lesson_Introduction_Text: lesson.Lessons_Lesson_Introduction_Text,
                    Lesson_Learning_Outcome: lesson.Lessons_Lesson_Learning_Outcome,
                    LessonsID: lesson.LessonsID,
                   	Status: status,  
                    Lessons_Your_Next_Step: lesson.Lessons_Your_Next_Step,
                    Lessons_Join_Your_New_Community: lesson.Lessons_Join_Your_New_Community,
                    Lessons_Give_Us_Your_Feedback: lesson.Lessons_Give_Us_Your_Feedback,
                    Lessons_Download_Your_Certificate: lesson.Lessons_Download_Your_Certificate,
                    Enrolment_Student_ID: lesson.Enrolment_Student_ID,
                    Module_Name: modulesMap[moduleId].Module_Name,
                    EnrolmentID: modulesMap[moduleId].EnrolmentID,
                    Don_t_Track_Progress: modulesMap[moduleId].Don_t_Track_Progress,
                    Course_Course_Access_Type: modulesMap[moduleId].Course_Course_Access_Type,
                    Module_Description: modulesMap[moduleId].Description,
                    Open_Date_Text: modulesMap[moduleId].Open_Date_Text,
                    isAvailable:modulesMap[moduleId].isAvailable,
                    Week_Open_from_Start_Date: modulesMap[moduleId].Week_Open_from_Start_Date
                });
            }
        }
    });

    let sortedModules = Object.values(modulesMap);
    sortedModules.sort((a, b) => a.Order - b.Order);

    console.log("Final Processed Modules:", sortedModules); 
    return sortedModules;
}

// Render Data using JsRender
async function renderModules() {
    const skeletonHTML = `
        <div class="skeleton-container">
            <div class="skeleton-card skeleton-shimmer"></div>
            <div class="skeleton-card skeleton-shimmer"></div>
            <div class="skeleton-card skeleton-shimmer"></div>
            <div class="skeleton-card skeleton-shimmer"></div>
            <div class="skeleton-card skeleton-shimmer"></div>
        </div>
    `;

    $("#modulesContainer").html(skeletonHTML);
    $("#progressModulesContainer").html(skeletonHTML);

    const modules = await combineModulesAndLessons();

    if (!Array.isArray(modules)) {
        console.error("Modules is not an array after processing:", modules);
        return;
    }

    const template = $.templates("#modulesTemplate");
    const htmlOutput = template.render({ modules });

    const progressTemplate = $.templates("#progressModulesTemplate");
    const progressOutput = progressTemplate.render({ modules });

    $("#modulesContainer").html(htmlOutput);
    $("#progressModulesContainer").html(progressOutput);
}

function addEventListenerIfExists(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, handler);
    }
}

addEventListenerIfExists("fetchModulesLessons", "click", renderModules);
addEventListenerIfExists("fetchProgressModulesLessons", "click", renderModules);
addEventListenerIfExists("finalMessageButton", "click", renderModules);
