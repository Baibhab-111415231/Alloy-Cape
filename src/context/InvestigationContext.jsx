import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  getInvestigations,
} from "../services/investigation/investigationSupabaseService";

const InvestigationContext = createContext();

export function InvestigationProvider({ children }) {
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadInvestigations() {
    try {
      setLoading(true);

      const data = await getInvestigations();

      setInvestigations(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (err) {
      console.error(
        "INVESTIGATIONS LOAD ERROR",
        err
      );

      setInvestigations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvestigations();
  }, []);

  return (
    <InvestigationContext.Provider
      value={{
        investigations,
        setInvestigations,
        loadInvestigations,
        loading,
      }}
    >
      {children}
    </InvestigationContext.Provider>
  );
}

export function useInvestigations() {
  return useContext(
    InvestigationContext
  );
}