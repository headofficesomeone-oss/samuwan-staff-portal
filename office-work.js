let officeWorkUser = null;
let officeWorkClients = [];

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    const form =
      document.getElementById(
        "officeWorkForm"
      );

    form?.addEventListener(
      "submit",
      submitOfficeWork
    );

    document
      .getElementById("startTime")
      ?.addEventListener(
        "change",
        updateOfficeWorkMinutes
      );

    document
      .getElementById("endTime")
      ?.addEventListener(
        "change",
        updateOfficeWorkMinutes
      );

    officeWorkUser =
      getOfficeWorkUserFromUrl();

    if (
      !officeWorkUser ||
      !officeWorkUser.employeeId ||
      !officeWorkUser.employeeName
    ) {
      alert(
        "職員情報を確認できません。" +
        "職員ポータルから開き直してください。"
      );

      location.href = "./index.html";
      return;
    }

    showOfficeWorkUser();
    setOfficeWorkDefaultDate();

    try {
      await loadOfficeWorkClients();
    } catch (error) {
      console.error(
        "利用者一覧取得エラー",
        error
      );

      setOfficeWorkMessage(
        "利用者一覧を取得できませんでした。" +
        "関連利用者を指定しない場合は、そのまま登録できます。",
        "error"
      );
    }
  }
);


function getOfficeWorkUserFromUrl() {
  const params =
    new URLSearchParams(
      location.search
    );

  return {
    employeeId:
      String(
        params.get("employeeId") || ""
      ).trim(),

    employeeName:
      String(
        params.get("employeeName") || ""
      ).trim()
  };
}


function showOfficeWorkUser() {
  const area =
    document.getElementById(
      "officeWorkUserName"
    );

  if (!area || !officeWorkUser) {
    return;
  }

  area.textContent =
    officeWorkUser.employeeName +
    " さん";
}


function setOfficeWorkDefaultDate() {
  const input =
    document.getElementById(
      "workDate"
    );

  if (!input) {
    return;
  }

  const now = new Date();

  const formatter =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    );

  const parts =
    formatter.formatToParts(now);

  const map = {};

  parts.forEach(part => {
    map[part.type] = part.value;
  });

  input.value =
    map.year +
    "-" +
    map.month +
    "-" +
    map.day;
}


async function loadOfficeWorkClients() {
  const result =
    await postGas({
      action: "getClientList"
    });

  if (!result.success) {
    throw new Error(
      result.message ||
      "利用者一覧を取得できませんでした。"
    );
  }

  officeWorkClients =
    Array.isArray(result.clients)
      ? result.clients
      : [];

  const select =
    document.getElementById(
      "relatedClient"
    );

  if (!select) {
    return;
  }

  select.innerHTML =
    '<option value="">' +
    '関連利用者なし' +
    '</option>';

  officeWorkClients.forEach(
    client => {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        client.clientId || "";

      option.textContent =
        client.name || "";

      option.dataset.clientName =
        client.name || "";

      select.appendChild(option);
    }
  );
}


function updateOfficeWorkMinutes() {
  const start =
    document.getElementById(
      "startTime"
    )?.value || "";

  const end =
    document.getElementById(
      "endTime"
    )?.value || "";

  const area =
    document.getElementById(
      "calculatedMinutes"
    );

  if (!area) {
    return;
  }

  if (!start || !end) {
    area.textContent =
      "作業時間：—";
    return;
  }

  const minutes =
    calculateOfficeWorkMinutes(
      start,
      end
    );

  if (
    minutes <= 0 ||
    minutes > 24 * 60
  ) {
    area.textContent =
      "作業時間：時刻を確認してください";
    return;
  }

  area.textContent =
    "作業時間：" +
    minutes +
    "分";
}


function calculateOfficeWorkMinutes(
  startText,
  endText
) {
  const startParts =
    String(startText)
      .split(":")
      .map(Number);

  const endParts =
    String(endText)
      .split(":")
      .map(Number);

  if (
    startParts.length < 2 ||
    endParts.length < 2
  ) {
    return 0;
  }

  let start =
    startParts[0] * 60 +
    startParts[1];

  let end =
    endParts[0] * 60 +
    endParts[1];

  if (end <= start) {
    end += 24 * 60;
  }

  return end - start;
}


async function submitOfficeWork(
  event
) {
  event.preventDefault();

  if (!officeWorkUser) {
    alert(
      "職員情報を確認できません。"
    );
    return;
  }

  const workDate =
    document.getElementById(
      "workDate"
    ).value;

  const startTime =
    document.getElementById(
      "startTime"
    ).value;

  const endTime =
    document.getElementById(
      "endTime"
    ).value;

  const workCategory =
    document.getElementById(
      "workCategory"
    ).value;

  const workContent =
    document.getElementById(
      "workContent"
    ).value.trim();

  const relatedClientSelect =
    document.getElementById(
      "relatedClient"
    );

  const relatedClientId =
    relatedClientSelect?.value || "";

  const relatedClientName =
    relatedClientSelect &&
    relatedClientSelect.selectedIndex >= 0
      ? (
          relatedClientSelect
            .options[
              relatedClientSelect.selectedIndex
            ]
            .dataset.clientName || ""
        )
      : "";

  const place =
    document.getElementById(
      "workPlace"
    ).value;

  const note =
    document.getElementById(
      "officeWorkNote"
    ).value.trim();

  if (
    !workDate ||
    !startTime ||
    !endTime ||
    !workCategory ||
    !workContent ||
    !place
  ) {
    setOfficeWorkMessage(
      "必須項目を入力してください。",
      "error"
    );
    return;
  }

  const workMinutes =
    calculateOfficeWorkMinutes(
      startTime,
      endTime
    );

  if (
    workMinutes <= 0 ||
    workMinutes > 24 * 60
  ) {
    setOfficeWorkMessage(
      "開始時刻と終了時刻を確認してください。",
      "error"
    );
    return;
  }

  const confirmed =
    confirm(
      officeWorkUser.employeeName +
      "\n" +
      workDate +
      " " +
      startTime +
      "～" +
      endTime +
      "\n" +
      workCategory +
      "\n\n" +
      "この内容で登録しますか？"
    );

  if (!confirmed) {
    return;
  }

  setOfficeWorkSubmitting(true);

  try {
    const result =
      await postGas({
        action: "saveOfficeWork",

        employeeId:
          officeWorkUser.employeeId,

        employeeName:
          officeWorkUser.employeeName,

        workDate:
          workDate,

        startTime:
          startTime,

        endTime:
          endTime,

        workCategory:
          workCategory,

        workContent:
          workContent,

        relatedClientId:
          relatedClientId,

        relatedClientName:
          relatedClientName,

        place:
          place,

        inputMethod:
          "手入力",

        note:
          note
      });

    if (!result.success) {
      throw new Error(
        result.message ||
        "事務作業を登録できませんでした。"
      );
    }

    alert(
      result.message ||
      "事務作業を登録しました。"
    );

    resetOfficeWorkForm();

  } catch (error) {
    console.error(
      "事務作業登録エラー",
      error
    );

    setOfficeWorkMessage(
      "登録に失敗しました：" +
      error.message,
      "error"
    );

  } finally {
    setOfficeWorkSubmitting(false);
  }
}


function resetOfficeWorkForm() {
  document
    .getElementById(
      "officeWorkForm"
    )
    ?.reset();

  setOfficeWorkDefaultDate();

  const select =
    document.getElementById(
      "relatedClient"
    );

  if (select) {
    select.value = "";
  }

  const area =
    document.getElementById(
      "calculatedMinutes"
    );

  if (area) {
    area.textContent =
      "作業時間：—";
  }

  setOfficeWorkMessage(
    "登録しました。続けて入力できます。",
    "success"
  );
}


function setOfficeWorkSubmitting(
  submitting
) {
  const button =
    document.getElementById(
      "officeWorkSubmitButton"
    );

  if (!button) {
    return;
  }

  button.disabled = submitting;

  button.classList.toggle(
    "office-work-submit-busy",
    submitting
  );

  button.textContent =
    submitting
      ? "登録中です…"
      : "登録する";
}


function setOfficeWorkMessage(
  message,
  type
) {
  const area =
    document.getElementById(
      "officeWorkMessage"
    );

  if (!area) {
    return;
  }

  area.innerHTML = "";

  if (!message) {
    return;
  }

  const div =
    document.createElement(
      "div"
    );

  div.className =
    "message-box " +
    (
      type === "success"
        ? "success"
        : "error"
    );

  div.textContent = message;

  area.appendChild(div);
}


function goBackPortal() {
  location.href = "./index.html";
}
