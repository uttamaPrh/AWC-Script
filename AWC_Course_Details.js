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

// Function to convert Unix timestamp to a readable date format
function formatDate(unixTimestamp) {
    if (!unixTimestamp) return "Invalid Date";
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
}

// Function to fetch customisation data for a module
async function fetchModuleCustomisation(moduleID) {
    const customisationQuery = `
        query {
            calcClassCustomisations(
                query: [{ where: { module_to_modify_id: ${moduleID} } }]
                limit: 1
                offset: 0
                orderBy: [{ path: ["created_at"], type: desc }]
            ) {
                ID: field(arg: ["id"])
                Date_Added: field(arg: ["created_at"])
                Days_to_Offset: field(arg: ["days_to_offset"])
                Specific_Date: field(arg: ["specific_date"])
            }
        }
    `;
    const response = await fetchGraphQL(customisationQuery);
    const customisation = response?.calcClassCustomisations?.[0] || null;
    
    console.log(`Customisation Data for Module ${moduleID}:`, customisation ? "Available" : "Not Available", customisation);
    
    return customisation;
}
//function to fetch lesson assessment due date
// Function to fetch lesson customization for Assessments
async function fetchLessonCustomisation(lessonID) {
    console.log(`🔍 Fetching Customisation for Lesson ID: ${lessonID}`);

    const customisationQuery = `
        query {
            calcClassCustomisations(
                query: [
                    { where: { lesson_to_modify_id: ${lessonID} } }
                    {
                        andWhere: {
                            Lesson_to_Modify: [
                                { where: { type: "Assessment" } }
                            ]
                        }
                    }
                ]
                limit: 1
                offset: 0
                orderBy: [{ path: ["created_at"], type: desc }]
            ) {
                ID: field(arg: ["id"])
                Date_Added: field(arg: ["created_at"])
                Days_to_Offset: field(arg: ["days_to_offset"])
                Specific_Date: field(arg: ["specific_date"])
            }
        }
    `;

    const response = await fetchGraphQL(customisationQuery);
    const customisation = response?.calcClassCustomisations?.[0] || null;
    
    console.log(`📌 Lesson Customisation Data for Lesson ${lessonID}:`, customisation ? "✅ Available" : "❌ Not Available", customisation);

    return customisation;
}

// Function to calculate the next Sunday from a given date
function getUpcomingSunday(startDateUnix, weeksOffset = 0) {
    const startDate = new Date(startDateUnix * 1000);
    let nextSunday = new Date(startDate);
    nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()) + (weeksOffset * 7));
    return Math.floor(nextSunday.getTime() / 1000);
}

// Function to determine due date for Assessments only
async function determineAssessmentDueDate(lesson, moduleStartDateUnix) {
    const lessonID = lesson.LessonsID;
    const dueWeek = lesson.Assessment_Due_End_of_Week;
    const customisation = await fetchLessonCustomisation(lessonID);

    let dueDateUnix;
    let dueDateText;

    if (customisation) {
        console.log(`🛠 Applying Lesson Customisation for Lesson ${lessonID}...`);

        if (customisation.Specific_Date) {
            dueDateUnix = customisation.Specific_Date > 9999999999
                ? Math.floor(customisation.Specific_Date / 1000)
                : customisation.Specific_Date;

            dueDateText = `Due on ${formatDate(dueDateUnix)}`;
            console.log(`📅 Using Specific Due Date: ${dueDateText} (Unix: ${dueDateUnix})`);
        } else if (customisation.Days_to_Offset !== null) {
            console.log("🔄 Applying Offset Logic for Due Date...");
            console.log("🔹 Offset Days:", customisation.Days_to_Offset);

            if (customisation.Days_to_Offset === 0) {
                dueDateUnix = moduleStartDateUnix;
            } else if (customisation.Days_to_Offset === -1) {
                dueDateUnix = getUpcomingSunday(moduleStartDateUnix, 0) - (24 * 60 * 60);
            } else if (customisation.Days_to_Offset === 1) {
                dueDateUnix = getUpcomingSunday(moduleStartDateUnix, 1) + (24 * 60 * 60);
            } else {
                dueDateUnix = getUpcomingSunday(moduleStartDateUnix, customisation.Days_to_Offset);
            }

            dueDateText = `Due on ${formatDate(dueDateUnix)}`;
            console.log(`📅 Due Date After Offset: ${dueDateText}`);
        } else {
            console.warn("⚠️ Customisation exists but has NO Specific Date or Offset. Using Default Logic.");
            dueDateUnix = getUpcomingSunday(moduleStartDateUnix, dueWeek);
            dueDateText = `Due on ${formatDate(dueDateUnix)}`;
        }
    } else {
        console.log(`❌ No Customisation for Lesson ${lessonID}, applying default due date logic...`);
        
        if (dueWeek === 0) {
            dueDateUnix = moduleStartDateUnix;
        } else {
            dueDateUnix = getUpcomingSunday(moduleStartDateUnix, dueWeek);
        }

        dueDateText = `Due on ${formatDate(dueDateUnix)}`;
    }

    console.log(`✅ Final Due Date Calculation: ${dueDateText}`);
    return { dueDateUnix, dueDateText };
}



// Function to determine module availability
function determineAvailability(startDateUnix, weeks, customisation) {
    if (!startDateUnix) {
        console.warn("⚠️ No Start Date Provided!");
        return { isAvailable: false, openDateText: "No Start Date" };
    }

    console.log(`📌 Processing Availability Calculation...`);
    console.log(`🔹 Start Date Unix: ${startDateUnix}`);
    console.log(`🔹 Weeks from Start Date: ${weeks}`);

    let openDateUnix;
    let openDateText;

    if (!customisation) {
        // Default logic when no customization exists
        openDateUnix = startDateUnix + (weeks * 7 * 24 * 60 * 60);
        openDateText = `Unlocks on ${formatDate(openDateUnix)}`;
        console.log("✅ No Customization Found. Using Default Open Date:", openDateText);
    } else {
        console.log("🛠 Customization Data Found:", customisation);

        if (customisation.Specific_Date) {
            // Convert Specific Date (Detect if it's in milliseconds or seconds)
            openDateUnix = customisation.Specific_Date > 9999999999 
                ? Math.floor(customisation.Specific_Date / 1000)  // Convert from ms to s
                : customisation.Specific_Date;  // Already in seconds

            openDateText = `Unlocks on ${formatDate(openDateUnix)}`;
            console.log(`📅 Using Specific Date from Customization: ${openDateText} (Unix: ${openDateUnix})`);
        } else if (customisation.Days_to_Offset !== null) {
            // Apply offset logic
            console.log("🔄 Applying Offset Logic...");
            console.log("🔹 Offset Days:", customisation.Days_to_Offset);

            openDateUnix = startDateUnix + (customisation.Days_to_Offset * 24 * 60 * 60);
            openDateText = `Unlocks on ${formatDate(openDateUnix)}`;
            console.log("📅 Open Date After Offset:", openDateText);
        } else {
            console.warn("⚠️ Customization exists but has NO Specific Date or Offset. Using Default Logic.");
            openDateUnix = startDateUnix + (weeks * 7 * 24 * 60 * 60);
            openDateText = `Unlocks on ${formatDate(openDateUnix)}`;
        }
    }

    const todayUnix = Math.floor(Date.now() / 1000);
    const isAvailable = openDateUnix >= todayUnix;

    console.log(`✅ Final Calculation: Open Date - ${openDateText}, Available - ${isAvailable}`);

    return { isAvailable, openDateText };
}



// Function to fetch lesson statuses
async function fetchLessonStatuses() {
    const completedLessons = await fetchGraphQL(completedQuery);
    const inProgressLessons = await fetchGraphQL(inProgressQuery);

    const completedSet = new Set(
        completedLessons?.calcOEnrolmentLessonCompletionLessonCompletions?.map(lesson => Number(lesson.Lesson_Completion_ID)) || []
    );
    const inProgressSet = new Set(
        inProgressLessons?.calcOLessonInProgressLessonEnrolmentinProgresses?.map(lesson => Number(lesson.Lesson_In_Progress_ID)) || []
    );

    return { completedSet, inProgressSet };
}

// Function to merge modules and lessons
// async function combineModulesAndLessons() {
//     const modulesResponse = await fetchGraphQL(getModulesQuery);
//     const lessonsResponse = await fetchGraphQL(getLessonsQuery);
//     const lessonStatuses = await fetchLessonStatuses(studentID);

//     const modules = modulesResponse?.calcModules || [];
//     const lessonsData = lessonsResponse?.calcModules || [];

//     if (!Array.isArray(modules) || !Array.isArray(lessonsData)) {
//         console.error("Modules or Lessons Data is not an array:", modules, lessonsData);
//         return [];
//     }

//     const modulesMap = {};

//     for (const module of modules) {
//         // Fetch customisation data for each module
//         const customisation = await fetchModuleCustomisation(module.ID);

//         // Determine availability based on customisation rules
//         const { isAvailable, openDateText } = determineAvailability(
//             module.Class_Start_Date,
//             module.Week_Open_from_Start_Date,
//             customisation
//         );

//         modulesMap[module.ID] = {
//             ...module,
//             Lessons: [],
//             Open_Date_Text: openDateText,
//             isAvailable: isAvailable,
//         };
//     }

//     // Create a set to track unique LessonsID
//     const uniqueLessonsSet = new Set();
//     for (const lesson of lessonsData) {
//   //  lessonsData.forEach(lesson => {
//         let moduleId = lesson.Lessons_Module_ID;
//         if (modulesMap[moduleId]) {
//             if (lesson.Lessons_Lesson_Name && !uniqueLessonsSet.has(lesson.LessonsID)) {
//                 uniqueLessonsSet.add(lesson.LessonsID);

//                 let status = "NotStarted";
//                 const lessonID = lesson.LessonsID;
//                 const isCompleted = lessonStatuses.completedSet.has(lessonID);
//                 const isInProgress = lessonStatuses.inProgressSet.has(lessonID);

//                 if (isCompleted) {
//                     status = "Completed";
//                 } else if (isInProgress) {
//                     status = "InProgress";
//                 }
//                let dueDateInfo = { dueDateUnix: null, dueDateText: "No Due Date" };
//             // ✅ Use `await` properly inside `for...of`
//             if (lesson.LessonsType === "Assessment") {
//                 dueDateInfo = await determineAssessmentDueDate(lesson, modulesMap[moduleId].Class_Start_Date);
//             }
//                 modulesMap[moduleId].Lessons.push({
//                     ...lesson, 
//                     Lesson_Name: lesson.Lessons_Lesson_Name,  // Lesson Name
//                     LessonsType: lesson.LessonsType,  // Lesson Type
//                     Lesson_AWC_Lesson_Content_Page_URL: lesson.Lesson_AWC_Lesson_Content_Page_URL,  // Lesson Content URL
//                     Lesson_Length_in_Hour: lesson.Lessons_Lesson_Length_in_Hour,  // Length in Hours
//                     Lesson_Length_in_Minute: lesson.Lesson_Lesson_Length_in_Minute,  // Length in Minutes
//                     Lesson_Length_in_Second: lesson.Lessons_Lesson_Length_in_Second,  // Length in Seconds
//                     Lesson_Introduction_Text: lesson.Lessons_Lesson_Introduction_Text,  // Introduction Text
//                     Lesson_Learning_Outcome: lesson.Lessons_Lesson_Learning_Outcome,  // Learning Outcome
//                     Due_Date_Text: dueDateInfo.dueDateText,
//                     LessonsID: lesson.LessonsID,  // Lesson ID
//                     Status: status,  // Lesson Status (Completed, InProgress, NotStarted)
//                     Lessons_Your_Next_Step: lesson.Lessons_Your_Next_Step,  // Next Step Guidance
//                     Lessons_Join_Your_New_Community: lesson.Lessons_Join_Your_New_Community,  // Community Link
//                     Lessons_Give_Us_Your_Feedback: lesson.Lessons_Give_Us_Your_Feedback,  // Feedback Link
//                     Lessons_Download_Your_Certificate: lesson.Lessons_Download_Your_Certificate,  // Certificate Download Link
//                     Enrolment_Student_ID: lesson.Enrolment_Student_ID,  // Student Enrollment ID
                
//                     // Module-level Information
//                     Module_Name: modulesMap[moduleId].Module_Name,  // Parent Module Name
//                     EnrolmentID: modulesMap[moduleId].EnrolmentID,  // Module Enrollment ID
//                     Don_t_Track_Progress: modulesMap[moduleId].Don_t_Track_Progress,  // Track Progress Flag
//                     Course_Course_Access_Type: modulesMap[moduleId].Course_Course_Access_Type,  // Course Access Type
//                     Module_Description: modulesMap[moduleId].Description,  // Module Description
//                     Open_Date_Text: modulesMap[moduleId].Open_Date_Text,  // Calculated Open Date Text
//                     isAvailable: modulesMap[moduleId].isAvailable,  // Lesson Availability
//                     Week_Open_from_Start_Date: modulesMap[moduleId].Week_Open_from_Start_Date,  // Weeks Offset for Lesson Opening
//                 });

//             }
//         }
//     };

//     let sortedModules = Object.values(modulesMap);
//     sortedModules.sort((a, b) => a.Order - b.Order);

//     return sortedModules;
// }

async function combineModulesAndLessons() {
    const modulesResponse = await fetchGraphQL(getModulesQuery);
    const lessonsResponse = await fetchGraphQL(getLessonsQuery);
    const lessonStatuses = await fetchLessonStatuses(studentID);

    const modules = modulesResponse?.calcModules || [];
    const lessonsData = lessonsResponse?.calcLessons || []; // ✅ Use correct source

    if (!Array.isArray(modules) || !Array.isArray(lessonsData)) {
        console.error("Modules or Lessons Data is not an array:", modules, lessonsData);
        return [];
    }

    const modulesMap = {};

    // Populate modulesMap
    for (const module of modules) {
        const customisation = await fetchModuleCustomisation(module.ID);
        const { isAvailable, openDateText } = determineAvailability(
            module.Class_Start_Date,
            module.Week_Open_from_Start_Date,
            customisation
        );

        modulesMap[module.ID] = {
            ...module,
            Lessons: [],
            Open_Date_Text: openDateText,
            isAvailable: isAvailable,
        };
    }

    // Track unique lesson IDs
    const uniqueLessonsSet = new Set();
    
    // Process lessons
    const assessmentPromises = [];

    for (const lesson of lessonsData) {
        let moduleId = lesson.Module_ID;
        
        if (modulesMap[moduleId] && lesson.Lesson_Name && !uniqueLessonsSet.has(lesson.ID)) {
            uniqueLessonsSet.add(lesson.ID);

            let status = "NotStarted";
            const lessonID = lesson.ID;

            if (lessonStatuses.completedSet.has(lessonID)) {
                status = "Completed";
            } else if (lessonStatuses.inProgressSet.has(lessonID)) {
                status = "InProgress";
            }

            // Placeholder for due date (if assessment)
            let dueDateInfo = { dueDateUnix: null, dueDateText: "No Due Date" };
            if (lesson.Type === "Assessment") {
                dueDateInfo = await determineAssessmentDueDate(lesson, modulesMap[moduleId].Class_Start_Date);
            }

            // Push lesson into the module
            modulesMap[moduleId].Lessons.push({
                ...lesson,
                Lessons_Unique_ID:lesson.Unique_ID,
                Lessons_Lesson_Name: lesson.Lesson_Name, // ✅ From new query
                Lesson_AWC_Lesson_Content_Page_URL: lesson.AWC_Lesson_Content_Page_URL, // ✅ From new query
                Lessons_Lesson_Length_in_Hour: lesson.Lesson_Length_in_Hour, // ✅ From new query
                Lessons_Lesson_Length_in_Minute: lesson.Lesson_Length_in_Minute, // ✅ From new query
                Lessons_Lesson_Length_in_Second: lesson.Lesson_Length_in_Second, // ✅ From new query
                Lessons_Lesson_Introduction_Text: lesson.Lesson_Introduction_Text, // ✅ From new query
                Lessons_Lesson_Learning_Outcome: lesson.Lesson_Learning_Outcome, // ✅ From new query
                LessonsID: lesson.ID, // ✅ From new query
                LessonsType: lesson.Type, // ✅ From new query
                Due_Date_Text: dueDateInfo.dueDateText, // Will be updated later
                Status: status, // ✅ From lesson status
                Lessons_Your_Next_Step: lesson.Your_Next_Step, // ✅ From new query
                Lessons_Join_Your_New_Community: lesson.Join_Your_New_Community, // ✅ From new query
                Lessons_Give_Us_Your_Feedback: lesson.Give_Us_Your_Feedback, // ✅ From new query
                Lessons_Download_Your_Certificate: lesson.Download_Your_Certificate, // ✅ From new query
                Enrolment_Student_ID: lesson.Enrolment_Student_ID, // ✅ From new query

                // Module-level Information
                Module_Name: modulesMap[moduleId].Module_Name, // ✅ From module
                EnrolmentID: modulesMap[moduleId].EnrolmentID, // ✅ From module
                Don_t_Track_Progress: modulesMap[moduleId].Don_t_Track_Progress, // ✅ From module
                Course_Course_Access_Type: modulesMap[moduleId].Course_Course_Access_Type, // ✅ From module
                Module_Description: modulesMap[moduleId].Description, // ✅ From module
                Open_Date_Text: modulesMap[moduleId].Open_Date_Text, // ✅ From module
                isAvailable: modulesMap[moduleId].isAvailable, // ✅ From module
                Week_Open_from_Start_Date: modulesMap[moduleId].Week_Open_from_Start_Date, // ✅ From module
            });
        }
    }

    // Wait for all assessments' due dates to be determined
    await Promise.all(assessmentPromises);

    // Sort modules by order
    let sortedModules = Object.values(modulesMap);
    sortedModules.sort((a, b) => a.Order - b.Order);

    return sortedModules;
}


// Function to render modules using JsRender
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

// Event Listeners
// function addEventListenerIfExists(id, event, handler) {
//     const element = document.getElementById(id);
//     if (element) {
//         element.addEventListener(event, handler);
//     }
// }
function addEventListenerIfExists(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, async () => {
            await handler();  // ✅ Fixed async execution
        });
    }
}


addEventListenerIfExists("fetchModulesLessons", "click", renderModules);
addEventListenerIfExists("fetchProgressModulesLessons", "click", renderModules);
addEventListenerIfExists("finalMessageButton", "click", renderModules);
