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
        return result.data.calcModules;
    } catch (error) {
        console.error("Error fetching data:", error);
        return [];
    }
}

// Function to convert Unix timestamp to readable date format
function formatDate(unixTimestamp) {
    if (!unixTimestamp) return "Invalid Date";
    const date = new Date(unixTimestamp * 1000); // Convert seconds to milliseconds
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

// Merge Modules with Lessons and Sort by Order
async function combineModulesAndLessons() {
    const modules = await fetchGraphQL(getModulesQuery);
    const lessonsData = await fetchGraphQL(getLessonsQuery);

    console.log("Modules Data:", modules); // Debugging - Check Modules Structure
    console.log("Lessons Data:", lessonsData); // Debugging - Check Lessons Structure

    const modulesMap = {};

    // Initialize modules and ensure an empty Lessons array
    modules.forEach(module => {
        const openDateText = calculateOpenDate(module.Class_Start_Date, module.Week_Open_from_Start_Date);

        modulesMap[module.ID] = {
            ...module,
            Lessons: [],
            Open_Date_Text: openDateText
        };
    });
    // if student id =[visitor id] and Lesson_in_Progress = LessonsID

    // Merge lessons into the correct module
  // Create a set to track unique LessonsID
const uniqueLessonsSet = new Set();

lessonsData.forEach(lesson => {
    let moduleId = lesson.ID || lesson.LessonsID;
    if (modulesMap[moduleId]) {
        // Ensure module has Lessons and avoid duplicates
        if (lesson.Lessons_Lesson_Name && !uniqueLessonsSet.has(lesson.LessonsID)) {
            uniqueLessonsSet.add(lesson.LessonsID); // Track this LessonsID

            modulesMap[moduleId].Lessons.push({
                ...lesson, // Spread lesson properties
                Lesson_Name: lesson.Lessons_Lesson_Name,
                LessonsType: lesson.LessonsType,
                Lesson_AWC_Lesson_Content_Page_URL: lesson.Lesson_AWC_Lesson_Content_Page_URL,
                Lesson_Length_in_Hour: lesson.Lessons_Lesson_Length_in_Hour,
                Lesson_Length_in_Minute: lesson.Lesson_Lesson_Length_in_Minute,
                Lesson_Length_in_Second: lesson.Lessons_Lesson_Length_in_Second,
                Lesson_Introduction_Text: lesson.Lessons_Lesson_Introduction_Text,
                Lesson_Learning_Outcome: lesson.Lessons_Lesson_Learning_Outcome,
                LessonID: lesson.LessonID,
                LessonsID: lesson.LessonsID,
                Lessons_Your_Next_Step: lesson.Lessons_Your_Next_Step,
                Lessons_Join_Your_New_Community: lesson.Lessons_Join_Your_New_Community,
                Lessons_Give_Us_Your_Feedback: lesson.Lessons_Give_Us_Your_Feedback,
                Lessons_Download_Your_Certificate: lesson.Lessons_Download_Your_Certificate,
                Enrolment_Student_ID: lesson.Enrolment_Student_ID,
                OLessonInProgressLessonEnrolmentinProgress_Lesson_In_Progress_ID: lesson.OLessonInProgressLessonEnrolmentinProgress_Lesson_In_Progress_ID,
                Module_Name: modulesMap[moduleId].Module_Name,
                EnrolmentID: modulesMap[moduleId].EnrolmentID,
                Don_t_Track_Progress: modulesMap[moduleId].Don_t_Track_Progress,
                Course_Course_Access_Type: modulesMap[moduleId].Course_Course_Access_Type,
                Module_Description: modulesMap[moduleId].Description,
                Open_Date_Text: modulesMap[moduleId].Open_Date_Text,
                Week_Open_from_Start_Date: modulesMap[moduleId].Week_Open_from_Start_Date
            });
        }
    }
});


    let sortedModules = Object.values(modulesMap);
    sortedModules.sort((a, b) => a.Order - b.Order);

    console.log("Final Processed Modules:", sortedModules); // Debugging - Check Final Structure
    return sortedModules;
}


// Render Data using JsRender
async function renderModules() {
    // Show Skeleton Loader with 5 Cards
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

    // Fetch Data
    const modules = await combineModulesAndLessons();

    // Render Templates
    const template = $.templates("#modulesTemplate");
    const htmlOutput = template.render({ modules });

    const progressTemplate = $.templates("#progressModulesTemplate");
    const progressOutput = progressTemplate.render({ modules });

    // Replace Skeleton with Real Data
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

