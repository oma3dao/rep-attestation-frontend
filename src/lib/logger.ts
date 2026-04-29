const logger = {
  log: (...args: any[]) => {
    if (process.env.NEXT_PUBLIC_DEBUG_ADAPTER === 'true' || process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (process.env.NEXT_PUBLIC_DEBUG_ADAPTER === 'true' || process.env.NODE_ENV === 'development') {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    console.error(...args);
    // TODO: Integrate with error tracking services if needed
  },
};

export default logger; 
