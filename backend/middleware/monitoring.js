const monitoring = {
  startTime: Date.now(),
  activeIngestions: new Map(),
  
  trackIngestion(ingestionId) {
    this.activeIngestions.set(ingestionId, {
      startTime: Date.now(),
      rowsProcessed: 0,
      memoryUsage: process.memoryUsage(),
      errors: []
    });
  },
  
  updateProgress(ingestionId, rows) {
    const ingestion = this.activeIngestions.get(ingestionId);
    ingestion.rowsProcessed += rows;
    ingestion.memoryUsage = process.memoryUsage();
  }
}; 