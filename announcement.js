
  const apiUrl = "https://eduflowpro.vitalstats.app/api/v1/graphql";
  const apiKey = "CpoyxZCcjURklXACKfifF";
  const classID = "[Page//ID]";
  const LOGGED_IN_USER_IMAGE = "[Visitor//Profile Image ##link]";
  const LOGGED_IN_USER_ID = "[Visitor//Contact ID]";
  const LOGGED_IN_USER_FIRST_NAME = "[Visitor//First Name]";
  const LOGGED_IN_USER_LAST_NAME = "[Visitor//Last Name]";
  const DEFAULT_AVATAR =
        "https://file.ontraport.com/media/41ca85f5cdde4c12bf72c2c73747633f.phpkeya0n?Expires=4884400377&Signature=SnfrlziQIcYSbZ98OrH2guVWpO4BRcxatgk3lM~-mKaAencWy7e1yIuxDT4hQjz0hFn-fJ118InfvymhaoqgGxn63rJXeqJKB4JTkYauub5Jh5UO3z6S0o~RVMj8AMzoiImsvQoPuRK7KnuOAsGiVEmSsMHEiM69IWzi4dW~6pryIMSHQ9lztg1powm8b~iXUNG8gajRaQWxlTiSyhh-CV-7zkF-MCP5hf-3FAKtGEo79TySr5SsZApLjfOo-8W~F8aeXK8BGD3bX6T0U16HsVeu~y9gDCZ1lBbLZFh8ezPL~4gktRbgP59Us8XLyV2EKn6rVcQCsVVUk5tUVnaCJw__&Key-Pair-Id=APKAJVAAMVW6XQYWSTNA";

  function formatProfileImage(imageUrl) {
    return imageUrl || DEFAULT_AVATAR;
  }

  function formatDateTimeFromUnix(timestamp) {
    const inputDate = new Date(timestamp * 1000);
    const now = new Date();
    const differenceInSeconds = Math.floor((now - inputDate) / 1000);
    const differenceInMinutes = Math.floor(differenceInSeconds / 60);
    const differenceInHours = Math.floor(differenceInMinutes / 60);
    const differenceInDays = Math.floor(differenceInHours / 24);

    if (differenceInSeconds < 60) return `${differenceInSeconds} seconds ago`;
    if (differenceInMinutes < 60) return `${differenceInMinutes} minutes ago`;
    if (differenceInHours < 24) return `${differenceInHours} hours ago`;
    return `${differenceInDays} days ago`;
  }

  async function fetchAllAnnouncements(classID) {
    const query = `
query calcAnnouncements(
$id: EduflowproClassID
$limit: IntScalar
$offset: IntScalar
) {
calcAnnouncements(
query: [{ where: { Class: [{ where: { id: $id } }] } }]
limit: $limit
offset: $offset
orderBy: [{ path: ["created_at"], type: desc }]
) {
ID: field(arg: ["id"])
Title: field(arg: ["title"])
Content: field(arg: ["content"])
Date_Added: field(arg: ["created_at"])
Instructor_ID: field(arg: ["instructor_id"])
Instructor_First_Name: field(arg: ["Instructor", "first_name"])
Instructor_Last_Name: field(arg: ["Instructor", "last_name"])
Instructor_Profile_Image: field(arg: ["Instructor", "profile_image"])
Disable_Comments: field(arg: ["disable_comments"])
}
}
`;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
        },
        body: JSON.stringify({
          query,
          variables: { id: classID, limit: 5000, offset: 0 },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch announcements.");
      }

      const data = await response.json();
      return data?.data?.calcAnnouncements || [];
    } catch (error) {
      alert("Error fetching announcements. Please try again later.", error);
      return [];
    }
    }

      async function createAnnouncement(payload) {
      const query = `
mutation createAnnouncement(
$payload: AnnouncementCreateInput = null
) {
createAnnouncement(payload: $payload) {
ID: id
Title: title
Content: content
Date_Added: created_at
disable_comments
Instructor {
First_Name: first_name
Last_Name: last_name
Profile_Image: profile_image
}
}
}
`;

      try {
      const response = await fetch(apiUrl, {
      method: "POST",
        headers: {
          "Content-Type": "application/json",
            "Api-Key": apiKey,
        },
          body: JSON.stringify({ query, variables: { payload } }),
        });

          if (!response.ok) {
            throw new Error("Failed to create announcement.");
          }

          const data = await response.json();
          return data?.data?.createAnnouncement || null;
        } catch (error) {
          console.error("Error creating announcement:", error);
          return null;
        }
        }

          function renderAnnouncements(announcements) {
          const template = $.templates("#announcementTemplate");
          const htmlOutput = template.render(announcements);
          $("#announcementWrapper").html(htmlOutput);
        }

          function prependAnnouncement(announcement) {
          const template = $.templates("#announcementTemplate");
          const htmlOutput = template.render([announcement]);
          $("#announcementWrapper").prepend(htmlOutput);
        }

          document.addEventListener("DOMContentLoaded", async () => {
          const announcements = await fetchAllAnnouncements(classID);
          announcements.forEach((a) => {
          a.Date_Added = formatDateTimeFromUnix(a.Date_Added);
          a.Instructor_Profile_Image = formatProfileImage(
          a.Instructor_Profile_Image
          );
        });
          renderAnnouncements(announcements);
        });

          document
            .getElementById("announcementForm")
            .addEventListener("submit", async (e) => {
          e.preventDefault();
          const announcementForm = document.getElementById("announcementForm");
          const title = document.getElementById("announcementTitle").value.trim();
          const disableComments = document.getElementById("postCheck");
          const isCheckedComments = disableComments.checked;
          const content = document
            .getElementById("announcementContent")
            .value.trim();

          const tempAnnouncement = {
          ID: `temp_${Date.now()}`,
            Title: title,
              Content: content,
                Date_Added: "Just now",
                  Instructor_First_Name: LOGGED_IN_USER_FIRST_NAME,
                    Instructor_Last_Name: LOGGED_IN_USER_LAST_NAME,
                      Instructor_Profile_Image: formatProfileImage(LOGGED_IN_USER_IMAGE),
                        disable_comments: isCheckedComments,
        };

          prependAnnouncement(tempAnnouncement);

          const payload = {
            title,
            content,
            instructor_id: LOGGED_IN_USER_ID,
            class_id: classID,
            created_at: Math.floor(Date.now() / 1000),
            disable_comments: isCheckedComments,
          };
          announcementForm.reset();
          const createdAnnouncement = await createAnnouncement(payload);    

          if (createdAnnouncement) {
            const announcements = await fetchAllAnnouncements(classID);
            announcements.forEach((a) => {
              a.Date_Added = formatDateTimeFromUnix(a.Date_Added);
              a.Instructor_Profile_Image = formatProfileImage(
                a.Instructor_Profile_Image
              );
            });
            renderAnnouncements(announcements);
          }
        });

      document.addEventListener("click", (event) => {
        const toggleButton = event.target.closest(".actionToggleButton");

        if (toggleButton) {
          const wrapper = toggleButton.querySelector(".actionItemsWrapper");

          // Hide all other open wrappers
          document.querySelectorAll(".actionItemsWrapper").forEach((item) => {
            if (item !== wrapper) {
              item.classList.add("hidden");
            }
          });

          // Toggle the clicked wrapper
          if (wrapper) {
            wrapper.classList.toggle("hidden");
          }
        } else {
          // Hide all wrappers if clicking outside
          document.querySelectorAll(".actionItemsWrapper").forEach((item) => {
            item.classList.add("hidden");
          });
        }
      });

      async function deleteAnnouncement(id) {
        const announcementEl = document.querySelector(
          `[data-announcement-id="${id}"]`
        );
        const deleteAnnouncementMutation = `
mutation deleteAnnouncement($id: EduflowproAnnouncementID) {
deleteAnnouncement(query: [{ where: { id: $id } }]) {
id
}
}
`;

        // Immediately hide the announcement in the UI
        if (announcementEl) {
          announcementEl.style.opacity = 0.5; // Show as "in progress"
        }

        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Api-key": apiKey,
            },
            body: JSON.stringify({
              query: deleteAnnouncementMutation,
              variables: { id },
            }),
          });

          const result = await response.json();

          if (result.data?.deleteAnnouncement) {
              // Fully remove the announcement from the DOM after deletion
              if (announcementEl) {
              announcementEl.remove();
              }
              } else {
              console.error("Error deleting announcement:", result.errors);
              if (announcementEl) {
              announcementEl.style.opacity = 1; // Restore UI if deletion failed
              }
              }
              } catch (error) {
              console.error("Error during deletion process:", error);
              if (announcementEl) {
              announcementEl.style.opacity = 1; // Restore UI if an error occurred
              }
              }
              }
