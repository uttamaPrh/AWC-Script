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

// Function to determine module availability
function determineAvailability(startDateUnix, weeks, customisation) {
    if (!startDateUnix) return { isAvailable: false, openDateText: "No Start Date" };

    let openDateUnix;
    let openDateText;

    // If no customisation data, use default logic
    if (!customisation) {
        openDateUnix = startDateUnix + (weeks * 7 * 24 * 60 * 60);
        openDateText = `Unlocks on ${formatDate(openDateUnix)}`;
    } else {
        if (customisation.Specific_Date) {
            // Use the specific date from customization
            openDateUnix = Math.floor(new Date(customisation.Specific_Date).getTime() / 1000);
            openDateText = `Unlocks on ${formatDate(openDateUnix)}`;
        } else if (customisation.Days_to_Offset !== null) {
            // Apply the offset logic
            openDateUnix = startDateUnix + (customisation.Days_to_Offset * 24 * 60 * 60);
            openDateText = `Unlocks on ${formatDate(openDateUnix)}`;
        } else {
            return { isAvailable: false, openDateText: "No Customisation Applied" };
        }
    }

    const todayUnix = Math.floor(Date.now() / 1000);
    const isAvailable = openDateUnix >= todayUnix;

    console.log(`Final Availability Calculation: Open Date - ${openDateText}, Available - ${isAvailable}`);

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
async function combineModulesAndLessons() {
    const modulesResponse = await fetchGraphQL(getModulesQuery);
    const lessonsResponse = await fetchGraphQL(getLessonsQuery);
    const lessonStatuses = await fetchLessonStatuses(studentID);

    const modules = modulesResponse?.calcModules || [];
    const lessonsData = lessonsResponse?.calcModules || [];

    if (!Array.isArray(modules) || !Array.isArray(lessonsData)) {
        console.error("Modules or Lessons Data is not an array:", modules, lessonsData);
        return [];
    }

    const modulesMap = {};

    for (const module of modules) {
        // Fetch customisation data for each module
        const customisation = await fetchModuleCustomisation(module.ID);

        // Determine availability based on customisation rules
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

                if (isCompleted) {
                    status = "Completed";
                } else if (isInProgress) {
                    status = "InProgress";
                }
                modulesMap[moduleId].Lessons.push({
                    ...lesson, 
                    Lesson_Name: lesson.Lessons_Lesson_Name,  // Lesson Name
                    LessonsType: lesson.LessonsType,  // Lesson Type
                    Lesson_AWC_Lesson_Content_Page_URL: lesson.Lesson_AWC_Lesson_Content_Page_URL,  // Lesson Content URL
                    Lesson_Length_in_Hour: lesson.Lessons_Lesson_Length_in_Hour,  // Length in Hours
                    Lesson_Length_in_Minute: lesson.Lesson_Lesson_Length_in_Minute,  // Length in Minutes
                    Lesson_Length_in_Second: lesson.Lessons_Lesson_Length_in_Second,  // Length in Seconds
                    Lesson_Introduction_Text: lesson.Lessons_Lesson_Introduction_Text,  // Introduction Text
                    Lesson_Learning_Outcome: lesson.Lessons_Lesson_Learning_Outcome,  // Learning Outcome
                    LessonsID: lesson.LessonsID,  // Lesson ID
                    Status: status,  // Lesson Status (Completed, InProgress, NotStarted)
                    Lessons_Your_Next_Step: lesson.Lessons_Your_Next_Step,  // Next Step Guidance
                    Lessons_Join_Your_New_Community: lesson.Lessons_Join_Your_New_Community,  // Community Link
                    Lessons_Give_Us_Your_Feedback: lesson.Lessons_Give_Us_Your_Feedback,  // Feedback Link
                    Lessons_Download_Your_Certificate: lesson.Lessons_Download_Your_Certificate,  // Certificate Download Link
                    Enrolment_Student_ID: lesson.Enrolment_Student_ID,  // Student Enrollment ID
                
                    // Module-level Information
                    Module_Name: modulesMap[moduleId].Module_Name,  // Parent Module Name
                    EnrolmentID: modulesMap[moduleId].EnrolmentID,  // Module Enrollment ID
                    Don_t_Track_Progress: modulesMap[moduleId].Don_t_Track_Progress,  // Track Progress Flag
                    Course_Course_Access_Type: modulesMap[moduleId].Course_Course_Access_Type,  // Course Access Type
                    Module_Description: modulesMap[moduleId].Description,  // Module Description
                    Open_Date_Text: modulesMap[moduleId].Open_Date_Text,  // Calculated Open Date Text
                    isAvailable: modulesMap[moduleId].isAvailable,  // Lesson Availability
                    Week_Open_from_Start_Date: modulesMap[moduleId].Week_Open_from_Start_Date,  // Weeks Offset for Lesson Opening
                });

            }
        }
    });

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
function addEventListenerIfExists(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, handler);
    }
}

addEventListenerIfExists("fetchModulesLessons", "click", renderModules);
addEventListenerIfExists("fetchProgressModulesLessons", "click", renderModules);
addEventListenerIfExists("finalMessageButton", "click", renderModules);
