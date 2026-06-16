import React, { useEffect, useState } from "react";
import { loadDB, saveDB } from "./storage";
import type { Completion, DB } from "./types";
import { ShiftsPage } from "./components/ShiftsPage";
import { ExecutionBoardPage } from "./components/ExecutionBoardPage";

type Route =
  | { kind: "dashboard" }
  | { kind: "shift"; shiftId: number };

function parseHash(hash: string): Route {
  const raw = hash || "#/";

  if (raw.startsWith("#/shift/")) {
    const idPart = raw.replace("#/shift/", "");
    const id = Number(idPart);

    if (!Number.isNaN(id) && id > 0) {
      return { kind: "shift", shiftId: id };
    }
  }

  return { kind: "dashboard" };
}

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);

    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}

function navigate(path: string) {
  window.location.hash = path;
}

export default function App() {
  const [db, setDBState] = useState<DB>(() => loadDB());
  const route = useHashRoute();

  const setDB = (next: DB) => {
    setDBState(next);
    saveDB(next);
  };

  const upsertCompletion = (
    shiftId: number,
    shiftActivityId: number,
    status: Completion["status"] = "done"
  ) => {
    const next: DB = {
      ...db,
      shifts: db.shifts.map((shift) => {
        if (shift.id !== shiftId) return shift;

        const existing = shift.completions.find(
          (c) => c.shiftActivityId === shiftActivityId
        );

        if (!existing) {
          const completion: Completion = {
            id: db.nextId,
            shiftActivityId,
            status,
            timestamp: Date.now(),
            note: "",
            imageData: null,
          };

          return {
            ...shift,
            completions: [...shift.completions, completion],
          };
        }

        return {
          ...shift,
          completions: shift.completions.map((c) =>
            c.shiftActivityId === shiftActivityId
              ? { ...c, status, timestamp: Date.now() }
              : c
          ),
        };
      }),
      nextId: db.nextId + 1,
    };

    setDB(next);
  };

  const completeActivity = (shiftId: number, shiftActivityId: number) => {
    const shift = db.shifts.find((s) => s.id === shiftId);
    if (!shift) return;

    const existing = shift.completions.find(
      (c) => c.shiftActivityId === shiftActivityId
    );

    if (existing?.status === "done") return;

    upsertCompletion(shiftId, shiftActivityId, "done");
  };

  const undoCompleteActivity = (shiftId: number, shiftActivityId: number) => {
    const next: DB = {
      ...db,
      shifts: db.shifts.map((shift) => {
        if (shift.id !== shiftId) return shift;

        return {
          ...shift,
          completions: shift.completions.filter(
            (c) => c.shiftActivityId !== shiftActivityId
          ),
        };
      }),
    };

    setDB(next);
  };

  if (route.kind === "shift") {
    const shift = db.shifts.find((s) => s.id === route.shiftId);

    if (!shift) {
      navigate("/");
      return null;
    }

    return (
      <ExecutionBoardPage
        db={db}
        setDB={setDB}
        shift={shift}
        onBack={() => navigate("/")}
        onCompleteActivity={completeActivity}
        onUndoCompleteActivity={undoCompleteActivity}
      />
    );
  }

  return (
    <ShiftsPage
      db={db}
      setDB={setDB}
      onOpenShiftBoard={(id) => {
        if (id > 0) {
          navigate(`/shift/${id}`);
          return;
        }

        navigate("/");
      }}
    />
  );
}
