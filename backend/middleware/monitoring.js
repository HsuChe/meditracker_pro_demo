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
    console.log(`Started tracking ingestion: ${ingestionId}`);
  },
  
  updateProgress(ingestionId, rows) {
    const ingestion = this.activeIngestions.get(ingestionId);
    if (ingestion) {
      ingestion.rowsProcessed += rows;
      ingestion.memoryUsage = process.memoryUsage();
      ingestion.lastUpdate = Date.now();
    } else {
      console.warn(`Attempted to update progress for unknown ingestion: ${ingestionId}`);
    }
  },
  
  getProgress(ingestionId) {
    return this.activeIngestions.get(ingestionId);
  },
  
  getAllIngestions() {
    return Array.from(this.activeIngestions.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  },
  
  completeIngestion(ingestionId, status = 'completed') {
    const ingestion = this.activeIngestions.get(ingestionId);
    if (ingestion) {
      ingestion.status = status;
      ingestion.completedAt = Date.now();
      return true;
    }
    return false;
  }
};

module.exports = monitoring; 