let officeUser = null;

document.addEventListener(
  "DOMContentLoaded",
  initializeOfficePage
);

function initializeOfficePage() {

  officeUser =
    getSavedPortalUser();

  if (!officeUser) {

    document
      .getElementById(
        "officeAuthError"
      )
      .classList.remove("hidden");

    return;
  }

  document
    .getElementById(
      "officeActionArea"
    )
    .classList.remove("hidden");

  document.getElementById(
    "officeUserName"
  ).textContent =
    officeUser.employeeName +
    "";
}


async function sendSimpleOfficeAction(
  actionType
) {

  if (!officeUser) {
    return;
  }

  if (
    !confirm(
      actionType +
      "を記録しますか？"
    )
  ) {
    return;
  }

  setButtonsDisabled(true);

  showSending(true);

  try {

	const result =
	  await postGas({

	    action:
	      "recordOfficeAction",

	    employeeId:
	      officeUser.employeeId,

	    employeeName:
	      officeUser.employeeName,

	    actionType:
	      actionType,

	    deviceTime:
	      new Date().toISOString(),

	    sendId:
	      createSimpleOfficeSendId(
	        officeUser.employeeId,
	        actionType
	      ),

	    registrationMethod:
	      "簡易事務所画面",

	    note:
	      ""

	  });
  
    showSending(false);

    showResult(
      result.message ||
      "登録しました。",
      result.success
    );

  } catch (error) {

    showSending(false);

    showResult(
      error.message,
      false
    );

  }

  setButtonsDisabled(false);

}


function setButtonsDisabled(
  disabled
) {

  document.getElementById(
    "simpleOfficeOpenButton"
  ).disabled =
    disabled;

  document.getElementById(
    "simpleOfficeCloseButton"
  ).disabled =
    disabled;

}


function showSending(
  visible
) {

  document
    .getElementById(
      "officeSendingArea"
    )
    .classList.toggle(
      "hidden",
      !visible
    );

}


function showResult(
  message,
  success
) {

  const area =
    document.getElementById(
      "officeResultArea"
    );

  area.classList.remove(
    "hidden"
  );

  area.textContent =
    message;

  area.className =
    "office-message " +
    (
      success
        ? "office-success"
        : "office-error"
    );

}
function createSimpleOfficeSendId(
  employeeId,
  actionType
) {
  return [
    "OFFICE",
    employeeId,
    actionType,
    Date.now(),
    Math.random()
      .toString(36)
      .substring(2, 10)
  ].join("-");
}
