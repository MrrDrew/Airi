import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Filter,
  Plus,
  Settings,
  ArrowLeft,
} from "lucide-react";
import "./App.css";

const monthNames = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

const monthNamesGenitive = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const weekDays = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const USER_ID = 5475516823;

function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date, diff) {
  return new Date(date.getFullYear(), date.getMonth() + diff, 1);
}

function getCalendarCells(viewDate) {
  const start = startOfMonth(viewDate);
  const end = endOfMonth(viewDate);
  const startWeekday = (start.getDay() + 6) % 7;
  const cells = [];

  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() - (startWeekday - i));
    cells.push({ date: d, outside: true });
  }

  for (let day = 1; day <= end.getDate(); day++) {
    cells.push({
      date: new Date(viewDate.getFullYear(), viewDate.getMonth(), day),
      outside: false,
    });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last);
    d.setDate(last.getDate() + 1);
    cells.push({ date: d, outside: true });
  }

  return cells;
}

function countForDate(dateKey, monthData) {
  return monthData[dateKey] || 0;
}


const allTimezones =
  typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [
        "Europe/Minsk",
        "Europe/Moscow",
        "Europe/Berlin",
        "Europe/London",
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "Asia/Dubai",
        "Asia/Karachi",
        "Asia/Kolkata",
        "Asia/Bangkok",
        "Asia/Shanghai",
        "Asia/Hong_Kong",
        "Asia/Singapore",
        "Asia/Tokyo",
        "Australia/Sydney",
        "Pacific/Auckland",
      ];



function getTimezoneOffsetLabel(timeZone) {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
    }).formatToParts(now);

    const raw = parts.find((p) => p.type === "timeZoneName")?.value || "UTC";

    if (raw === "GMT" || raw === "UTC") return "UTC";

    const normalized = raw.replace("GMT", "UTC");
    return normalized;
  } catch {
    return "UTC";
  }
}


function getTimezoneOffsetMinutes(timeZone) {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
    }).formatToParts(now);

    const raw = parts.find((p) => p.type === "timeZoneName")?.value || "UTC";

    if (raw === "GMT" || raw === "UTC") return 0;

    const match = raw.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!match) return 0;

    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2] || 0);
    const minutes = Number(match[3] || 0);

    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

function getTimezoneDisplayName(timeZone) {
  const aliases = getTimezoneAliases(timeZone);
  if (aliases.length > 0) {
    return aliases
      .slice(0, 2)
      .join(" / ");
  }

  const pretty = timeZone.replaceAll("_", " ");
  const parts = pretty.split("/");
  return parts[parts.length - 1];
}

function getTimezoneCurrentTime(timeZone) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone,
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
  } catch {
    return "";
  }
}


const timezoneAliases = {
  "Europe/Minsk": ["Minsk", "Минск", "Belarus", "Беларусь"],
  "Europe/Moscow": ["Moscow", "Москва", "Russia", "Россия"],
  "Europe/Kaliningrad": ["Kaliningrad", "Калининград"],
  "Europe/Samara": ["Samara", "Самара"],
  "Europe/Yekaterinburg": ["Yekaterinburg", "Екатеринбург"],
  "Europe/Berlin": ["Berlin", "Берлин", "Germany", "Германия"],
  "Europe/Paris": ["Paris", "Париж", "France", "Франция"],
  "Europe/Rome": ["Rome", "Рим", "Italy", "Италия"],
  "Europe/Madrid": ["Madrid", "Мадрид", "Spain", "Испания"],
  "Europe/Warsaw": ["Warsaw", "Варшава", "Poland", "Польша"],
  "Europe/Prague": ["Prague", "Прага", "Czech", "Чехия"],
  "Europe/Vienna": ["Vienna", "Вена", "Austria", "Австрия"],
  "Europe/Bucharest": ["Bucharest", "Бухарест", "Romania", "Румыния"],
  "Europe/Athens": ["Athens", "Афины", "Greece", "Греция"],
  "Europe/Helsinki": ["Helsinki", "Хельсинки", "Finland", "Финляндия"],
  "Europe/Riga": ["Riga", "Рига", "Latvia", "Латвия"],
  "Europe/Vilnius": ["Vilnius", "Вильнюс", "Lithuania", "Литва"],
  "Europe/Tallinn": ["Tallinn", "Таллин", "Estonia", "Эстония"],
  "Europe/London": ["London", "Лондон", "UK", "Britain", "Англия", "Великобритания"],
  "Europe/Dublin": ["Dublin", "Дублин", "Ireland", "Ирландия"],
  "Europe/Istanbul": ["Istanbul", "Стамбул", "Turkey", "Турция"],
  "Europe/Kyiv": ["Kyiv", "Kiev", "Киев", "Украина", "Ukraine"],
  "Europe/Zurich": ["Zurich", "Цюрих", "Switzerland", "Швейцария"],

  "Asia/Dubai": ["Dubai", "Дубай", "UAE", "ОАЭ", "Emirates", "Эмираты"],
  "Asia/Tbilisi": ["Tbilisi", "Тбилиси", "Georgia", "Грузия"],
  "Asia/Yerevan": ["Yerevan", "Ереван", "Armenia", "Армения"],
  "Asia/Baku": ["Baku", "Баку", "Azerbaijan", "Азербайджан"],
  "Asia/Karachi": ["Karachi", "Карачи", "Pakistan", "Пакистан"],
  "Asia/Almaty": ["Almaty", "Алматы", "Kazakhstan", "Казахстан"],
  "Asia/Tashkent": ["Tashkent", "Ташкент", "Uzbekistan", "Узбекистан"],
  "Asia/Bishkek": ["Bishkek", "Бишкек", "Kyrgyzstan", "Киргизия", "Кыргызстан"],
  "Asia/Dushanbe": ["Dushanbe", "Душанбе", "Tajikistan", "Таджикистан"],
  "Asia/Ashgabat": ["Ashgabat", "Ашхабад", "Turkmenistan", "Туркменистан"],
  "Asia/Kolkata": ["Kolkata", "Calcutta", "Delhi", "Mumbai", "Индия", "India", "Дели", "Мумбаи"],
  "Asia/Kathmandu": ["Kathmandu", "Катманду", "Nepal", "Непал"],
  "Asia/Dhaka": ["Dhaka", "Дакка", "Bangladesh", "Бангладеш"],
  "Asia/Bangkok": ["Bangkok", "Бангкок", "Thailand", "Таиланд"],
  "Asia/Ho_Chi_Minh": ["Ho Chi Minh", "Saigon", "Хошимин", "Сайгон", "Vietnam", "Вьетнам"],
  "Asia/Phnom_Penh": ["Phnom Penh", "Пномпень", "Cambodia", "Камбоджа"],
  "Asia/Jakarta": ["Jakarta", "Джакарта", "Indonesia", "Индонезия"],
  "Asia/Kuala_Lumpur": ["Kuala Lumpur", "Куала-Лумпур", "Malaysia", "Малайзия"],
  "Asia/Singapore": ["Singapore", "Сингапур"],
  "Asia/Shanghai": ["Shanghai", "Beijing", "China", "Шанхай", "Пекин", "Китай"],
  "Asia/Hong_Kong": ["Hong Kong", "Гонконг"],
  "Asia/Macau": ["Macau", "Macao", "Макао"],
  "Asia/Taipei": ["Taipei", "Тайбэй", "Taiwan", "Тайвань"],
  "Asia/Seoul": ["Seoul", "Сеул", "Korea", "Кореея", "Южная Корея"],
  "Asia/Tokyo": ["Tokyo", "Токио", "Japan", "Япония"],
  "Asia/Manila": ["Manila", "Манила", "Philippines", "Филиппины"],

  "Australia/Perth": ["Perth", "Перт", "Australia", "Австралия"],
  "Australia/Adelaide": ["Adelaide", "Аделаида"],
  "Australia/Sydney": ["Sydney", "Сидней", "Melbourne", "Мельбурн"],
  "Pacific/Auckland": ["Auckland", "Окленд", "New Zealand", "Новая Зеландия"],

  "America/New_York": ["New York", "Нью-Йорк", "USA", "США", "East Coast"],
  "America/Chicago": ["Chicago", "Чикаго"],
  "America/Denver": ["Denver", "Денвер"],
  "America/Los_Angeles": ["Los Angeles", "Лос-Анджелес", "LA"],
  "America/Toronto": ["Toronto", "Торонто", "Canada", "Канада"],
  "America/Vancouver": ["Vancouver", "Ванкувер"],
  "America/Mexico_City": ["Mexico City", "Мехико", "Mexico", "Мексика"],
  "America/Sao_Paulo": ["Sao Paulo", "Сан-Паулу", "Brazil", "Бразилия"],
  "America/Buenos_Aires": ["Buenos Aires", "Буэнос-Айрес", "Argentina", "Аргентина"],
  "Africa/Cairo": ["Cairo", "Каир", "Egypt", "Египет"],
  "Africa/Johannesburg": ["Johannesburg", "Йоханнесбург", "South Africa", "ЮАР"]
};



function getTimezoneAliases(timeZone) {
  return timezoneAliases[timeZone] || [];
}


export default function App() {
  const today = new Date();

  const [viewDate, setViewDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), today.getDate())
  );

  const [monthData, setMonthData] = useState({});
  const [dayTasks, setDayTasks] = useState([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [filter, setFilter] = useState("all");
  const [screen, setScreen] = useState("calendar");
  const [timezone, setTimezone] = useState("");
  const [timezoneSearch, setTimezoneSearch] = useState("");
  const [showTimezoneList, setShowTimezoneList] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("12:00");
  const [newTaskType, setNewTaskType] = useState("task");
  const [creatingTask, setCreatingTask] = useState(false);

  const [archivedByDate, setArchivedByDate] = useState({});

  const [showTimezoneSavedModal, setShowTimezoneSavedModal] = useState(false);
  const [savedTimezoneLabel, setSavedTimezoneLabel] = useState("");
  const [savedTimezoneTime, setSavedTimezoneTime] = useState("");

  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  const selectedKey = toKey(selectedDate);
  const cells = useMemo(() => getCalendarCells(viewDate), [viewDate]);

  useEffect(() => {
    loadMonth();
  }, [viewDate]);

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    loadTimezone();
  }, []);

  const filteredItems = dayTasks.filter((item) => {
    if (filter === "all") return true;
    if (filter === "task") return item.reminder_type === "task";
    if (filter === "event") return item.reminder_type === "event";
    return false;
  });

  const archivedItemsForDay = archivedByDate[selectedKey] || [];
  const visibleItems = filter === "archive" ? archivedItemsForDay : filteredItems;

  const dayStats = {
    total: dayTasks.length,
    tasks: dayTasks.filter((x) => x.reminder_type === "task").length,
    events: dayTasks.filter((x) => x.reminder_type === "event").length,
  };
  const archiveCount = archivedItemsForDay.length;

  const filteredTimezones = useMemo(() => {
    if (screen !== "timezone" || !showTimezoneList) return [];
  
    const q = timezoneSearch.trim().toLowerCase();
  
    const quickList = [
      "Europe/Minsk",
      "Europe/Moscow",
      "Europe/Berlin",
      "Europe/London",
      "Asia/Dubai",
      "Asia/Bangkok",
      "Asia/Shanghai",
      "Asia/Hong_Kong",
      "Asia/Singapore",
      "Asia/Tokyo",
      "America/New_York",
      "America/Los_Angeles",
      "Australia/Sydney",
  ];

  if (!q) return quickList;

  return allTimezones
    .filter((tz) => getTimezoneSearchText(tz).includes(q))
    .slice(0, 80);
}, [screen, showTimezoneList, timezoneSearch]);



  function getTimezoneSearchText(timeZone) {
    return [
      timeZone,
      getTimezoneDisplayName(timeZone),
      getTimezoneOffsetLabel(timeZone),
      ...getTimezoneAliases(timeZone),
    ]
      .join(" ")
      .toLowerCase();
  }

  function getTimezoneLabel(timeZone) {
    const offset = getTimezoneOffsetLabel(timeZone);
    const display = getTimezoneDisplayName(timeZone);
    return ${offset} · ${display};
  }



  function getDefaultTime() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  async function loadMonth() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth() + 1;

    try {
      const res = await fetch(
        `/api/airi-calendar/month?user_id=${USER_ID}&year=${year}&month=${month}`
      );
      const data = await res.json();

      const map = {};
      if (Array.isArray(data)) {
        data.forEach((item) => {
          map[item.date] = item.count;
        });
      }

      setMonthData(map);
    } catch (e) {
      console.error("Failed to load month", e);
      setMonthData({});
    }
  }

  async function loadDay(dateObj) {
    const iso = toKey(dateObj);
    setLoadingDay(true);

    try {
      const res = await fetch(
        `/api/airi-calendar/day?user_id=${USER_ID}&date=${iso}`
      );
      const data = await res.json();
      setDayTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load day", e);
      setDayTasks([]);
    } finally {
      setLoadingDay(false);
    }
  }

  async function loadTimezone() {
    try {
      const res = await fetch(`/api/airi-timezone/get?user_id=${USER_ID}`);
      const data = await res.json();

      if (data?.timezone) {
        setTimezone(data.timezone);
      }
    } catch (e) {
      console.error("Failed to load timezone", e);
    }
  }


  async function saveTimezone(value) {
    try {
      const res = await fetch(`/api/airi-timezone/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: USER_ID,
          timezone: value,
        }),
      });

      const data = await res.json();

      if (data?.ok) {
        setTimezone(value);
      }
    } catch (e) {
      console.error("Failed to save timezone", e);
    }
  }



  async function completeTask(item) {
    try {
      const res = await fetch(
        `/api/airi-calendar/complete?reminder_id=${item.id}`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setArchivedByDate((prev) => {
        const current = prev[selectedKey] || [];
        if (current.some((x) => x.id === item.id)) return prev;

        return {
          ...prev,
          [selectedKey]: [{ ...item, archived: true }, ...current],
        };
      });

      await loadDay(selectedDate);
      await loadMonth();
    } catch (e) {
      console.error("Failed to complete task", e);
    }
  }

  function openCreateModal(dateOverride = null) {
    if (dateOverride) {
      setSelectedDate(dateOverride);
      setViewDate(
        new Date(dateOverride.getFullYear(), dateOverride.getMonth(), 1)
      );
    }

    setNewTaskText("");
    setNewTaskTime(getDefaultTime());
    setNewTaskType("task");
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
  }

  async function createTask() {
    if (!newTaskText.trim()) return;

    try {
      setCreatingTask(true);

      const dateKey = toKey(selectedDate);
      const remindAt = `${dateKey}T${newTaskTime}:00`;

      const res = await fetch(`/api/airi-calendar/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: USER_ID,
          task: newTaskText.trim(),
          reminder_type: newTaskType,
          remind_at: remindAt,
          is_recurring: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      closeCreateModal();
      await loadDay(selectedDate);
      await loadMonth();
    } catch (e) {
      console.error("Failed to create task", e);
    } finally {
      setCreatingTask(false);
    }
  }

  function handleDayPressStart(date) {
    clearLongPress();
    longPressTriggeredRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      openCreateModal(date);
    }, 500);
  }

  function clearLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleDayClick(date) {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    setSelectedDate(date);
  }

  if (screen === "settings") {
    return (
      <div className="app">
        <div className="container">
          <div className="card">
            <div className="card-header">
              <div className="header-left">
                <button
                  className="icon-button"
                  onClick={() => setScreen("calendar")}
                >
                  <ArrowLeft size={20} />
                </button>

                <div>
                  <h1 className="title">Настройки</h1>
                  <div className="subtitle">Параметры Airi</div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              <button
                className="today-button"
                style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => setScreen("timezone")}
              >
                🌍 Часовой пояс
              </button>

              <button
                className="today-button"
                style={{ width: "100%", justifyContent: "flex-start" }}
                onClick={() => alert("Настройки напоминаний добавим позже")}
              >
                🔔 Напоминания
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }


  if (screen === "timezone") {
  return (
    <div className="app">
      <div className="container">
        <div className="card">
          <div className="card-header">
            <div className="header-left">
              <button
                className="icon-button"
                onClick={() => {
                  setShowTimezoneList(false);
                  setTimezoneSearch("");
                  setScreen("settings");
                }}
              >
                <ArrowLeft size={20} />
              </button>

              <div>
                <h1 className="title">Часовой пояс</h1>
                <div className="subtitle">
                  Определите автоматически или выберите вручную
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            <button
              className="today-button"
              style={{ width: "100%" }}
              onClick={async () => {
                const detected =
                  Intl.DateTimeFormat().resolvedOptions().timeZone || "";
                if (!detected) return;

                await saveTimezone(detected);

                const prettyName = detected.replaceAll("_", " ");
                const currentTime = new Intl.DateTimeFormat("ru-RU", {
                  timeZone: detected,
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date());

                setSavedTimezoneLabel(prettyName);
                setSavedTimezoneTime(currentTime);
                setShowTimezoneSavedModal(true);
              }}
            >
              Определить автоматически
            </button>

            <button
              className="today-button"
              style={{ width: "100%" }}
              onClick={() => setShowTimezoneList((prev) => !prev)}
            >
              {showTimezoneList ? "Скрыть ручной выбор" : "Выбрать вручную"}
            </button>

            {timezone ? (
              <div className="subtitle">
                Текущий выбор: <b>{timezone.replaceAll("_", " ")}</b>
              </div>
            ) : (
              <div className="subtitle">Часовой пояс пока не выбран</div>
            )}

            {showTimezoneList && (
              <>
                <div className="subtitle">
                  Без поиска показаны популярные часовые пояса. Для полного
                  списка начни вводить город или timezone.
                </div>

                <input
                  value={timezoneSearch}
                  onChange={(e) => setTimezoneSearch(e.target.value)}
                  placeholder="Поиск города или timezone"
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid #2a2a2a",
                    background: "#111",
                    color: "#fff",
                  }}
                />

                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    maxHeight: "320px",
                    overflowY: "auto",
                  }}
                >
                  {filteredTimezones.map((tz) => (
                    <button
                      key={tz}
                      className="today-button"
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                        borderColor: timezone === tz ? "#f4a261" : "#2f2f35",
                      }}
                      onClick={async () => {
                        await saveTimezone(tz);
                        const prettyName = tz.replaceAll("_", " ");
                        const currentTime = new Intl.DateTimeFormat("ru-RU", {
                          timeZone: tz,
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date());

                        setSavedTimezoneLabel(prettyName);
                        setSavedTimezoneTime(currentTime);
                        setShowTimezoneSavedModal(true);
                      }}
                    >
                      <span style={{ textAlign: "left" }}>
                        {getTimezoneLabel(tz)}
                        <br />
                        <span style={{ opacity: 0.7, fontSize: "12px" }}>{tz}</span>
                      </span>
                      {timezone === tz ? <span>✓</span> : null}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {showTimezoneSavedModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              zIndex: 1200,
            }}
            onClick={() => setShowTimezoneSavedModal(false)}
          >
            <div
              className="card"
              style={{ width: "100%", maxWidth: "420px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "grid", gap: "12px" }}>
                <h2 className="title small" style={{ margin: 0 }}>
                  Часовой пояс сохранён
                </h2>

                <div className="subtitle" style={{ lineHeight: 1.5 }}>
                  Ваш часовой пояс сохранён: <b>{savedTimezoneLabel}</b>
                  <br />
                  Текущее время: <b>{savedTimezoneTime}</b>
                </div>

                <button
                  className="today-button"
                  style={{ width: "100%" }}
                  onClick={() => setShowTimezoneSavedModal(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

  {showTimezoneSavedModal && (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 1200,
      }}
      onClick={() => setShowTimezoneSavedModal(false)}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: "420px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "grid", gap: "12px" }}>
          <h2 className="title small" style={{ margin: 0 }}>
            Часовой пояс сохранён
          </h2>
  
          <div className="subtitle" style={{ lineHeight: 1.5 }}>
            Ваш часовой пояс сохранён: <b>{savedTimezoneLabel}</b>
            <br />
            Текущее время: <b>{savedTimezoneTime}</b>
          </div>

          <button
            className="today-button"
            style={{ width: "100%" }}
            onClick={() => setShowTimezoneSavedModal(false)}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )}



  return (
    <div className="app">
      <div className="container">
        <div className="card">
          <div className="card-header compact-header">
            <div className="header-left compact-left">
              <div className="icon-box orange compact-icon-box">
                <CalendarDays size={18} />
              </div>

              <div className="title-wrap">
                <h1 className="title compact-title">
                  {monthNames[viewDate.getMonth()].charAt(0).toUpperCase() +
                    monthNames[viewDate.getMonth()].slice(1)}{" "}
                  {viewDate.getFullYear()}
                </h1>
                <div className="subtitle">Календарь Airi</div>
              </div>
            </div>

            <div className="top-controls">
              <button
                className="icon-button compact-nav-button"
                onClick={() => setViewDate(addMonths(viewDate, -1))}
              >
                <ChevronLeft size={16} />
              </button>

              <button
                className="today-button compact-today-button"
                onClick={() => {
                  const now = new Date();
                  setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDate(
                    new Date(now.getFullYear(), now.getMonth(), now.getDate())
                  );
                }}
              >
                Сегодня
              </button>

              <button
                className="icon-button compact-nav-button"
                onClick={() => setViewDate(addMonths(viewDate, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button
              className="icon-button compact-settings-button"
              onClick={() => setScreen("settings")}
            >
              <Settings size={18} />
            </button>
          </div>

          <div className="weekdays">
            {weekDays.map((day) => (
              <div key={day} className="weekday">
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {cells.map(({ date, outside }) => {
              const key = toKey(date);
              const isSelected = key === selectedKey;
              const isToday = key === toKey(today);
              const count = countForDate(key, monthData);

              let className = "day-cell";
              if (outside) className += " outside";
              if (isSelected) className += " selected";
              if (isToday) className += " today";

              return (
                <button
                  key={key}
                  className={className}
                  onMouseDown={() => handleDayPressStart(date)}
                  onMouseUp={clearLongPress}
                  onMouseLeave={clearLongPress}
                  onTouchStart={() => handleDayPressStart(date)}
                  onTouchEnd={clearLongPress}
                  onTouchCancel={clearLongPress}
                  onClick={() => handleDayClick(date)}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <div
                      className="day-number"
                      style={{
                        lineHeight: 1,
                        marginBottom: count > 0 ? "8px" : "0",
                      }}
                    >
                      {date.getDate()}
                    </div>
                    {count > 0 && (
                      <div className="day-dots">
                        {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                          <div key={i} className="day-dot" />
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div
            className="card-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
              }}
            >
              <div>
                <h2 className="title small">
                  {selectedDate.getDate()}{" "}
                  {monthNamesGenitive[selectedDate.getMonth()]}
                </h2>
              </div>

              <button
                onClick={() => openCreateModal()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  background: "rgba(255,140,0,0.2)",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <Plus size={16} />
                Задача
              </button>
            </div>
          </div>

          <div className="filters-row">
            <div className="filters-title">
              <Filter size={16} />
              <span>Фильтр</span>
            </div>

            <div className="filters-buttons">
              <button
                className={`filter-button ${filter === "all" ? "active" : ""}`}
                onClick={() => setFilter("all")}
              >
                Все ({dayStats.total})
              </button>

              <button
                className={`filter-button ${filter === "task" ? "active" : ""}`}
                onClick={() => setFilter("task")}
              >
                Задачи ({dayStats.tasks})
              </button>

              <button
                className={`filter-button ${filter === "event" ? "active" : ""}`}
                onClick={() => setFilter("event")}
              >
                События ({dayStats.events})
              </button>

              <button
                className={`filter-button ${filter === "archive" ? "active" : ""}`}
                onClick={() => setFilter("archive")}
              >
                Архив ({archiveCount})
              </button>
            </div>
          </div>

          {loadingDay ? (
            <div className="empty-box">Загрузка...</div>
          ) : visibleItems.length === 0 ? (
            <div className="empty-box">
              {filter === "archive"
                ? "В архиве на этот день ничего нет"
                : "На этот день ничего нет"}
            </div>
          ) : (
            <div className="items-list">
              {visibleItems.map((item) => (
                <div key={`${filter}-${item.id}`} className="item-card">
                  <div className="item-content compact">
                    <div
                      className="item-time"
                      style={{
                        minWidth: "48px",
                        flex: "0 0 48px",
                        fontWeight: 600,
                        color: "#cfcfcf",
                      }}
                    >
                      {item.time}
                    </div>

                    <div
                      className="item-title-block"
                      style={{ minWidth: 0, flex: "1 1 auto", overflow: "hidden" }}
                    >
                      <div className="item-title-row">
                        <span className="item-inline-emoji">
                          {item.reminder_type === "event" ? "🔔" : "🗓️"}
                        </span>

                        <div
                          className="item-title multiline"
                          style={filter === "archive" ? { opacity: 0.75 } : undefined}
                        >
                          {item.task}
                        </div>

                        {item.is_recurring && <div className="mini-badge">🔁</div>}
                        {filter === "archive" && <div className="mini-badge">Архив</div>}
                      </div>
                    </div>
                  </div>

                  {filter !== "archive" && (
                    <button
                      className="complete-button compact"
                      onClick={(e) => {
                        e.stopPropagation();
                        completeTask(item);
                      }}
                      title="Удалить / завершить"
                    >
                      <span className="complete-button-x">✕</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {showCreateModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              zIndex: 1000,
            }}
            onClick={closeCreateModal}
          >
            <div
              className="card"
              style={{ width: "100%", maxWidth: "420px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-header">
                <div>
                  <h2 className="title small">Новая задача</h2>
                  <div className="subtitle">
                    {selectedDate.getDate()}{" "}
                    {monthNamesGenitive[selectedDate.getMonth()]}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                <input
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="Название задачи"
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid #2a2a2a",
                    background: "#111",
                    color: "#fff",
                  }}
                />

                <input
                  type="time"
                  value={newTaskTime}
                  onChange={(e) => setNewTaskTime(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid #2a2a2a",
                    background: "#111",
                    color: "#fff",
                  }}
                />

                <select
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid #2a2a2a",
                    background: "#111",
                    color: "#fff",
                  }}
                >
                  <option value="task">Задача</option>
                  <option value="event">Событие</option>
                </select>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className="today-button"
                    style={{ flex: 1 }}
                    onClick={closeCreateModal}
                    disabled={creatingTask}
                  >
                    Отмена
                  </button>

                  <button
                    className="today-button"
                    style={{
                      flex: 1,
                      background: "rgba(255,140,0,0.2)",
                      border: "1px solid rgba(255,140,0,0.35)",
                    }}
                    onClick={createTask}
                    disabled={creatingTask}
                  >
                    {creatingTask ? "Создание..." : "Создать"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
