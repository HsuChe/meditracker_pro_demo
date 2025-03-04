const monitoring = {
  startTime: Date.now(),
  activeIngestions: new Map(),
  
  /**
   * Start tracking a new ingestion process
   * @param {string} ingestionId - Unique identifier for the ingestion
   * @param {Object} metadata - Optional metadata about the ingestion
   */
  trackIngestion(ingestionId, metadata = {}) {
    this.activeIngestions.set(ingestionId, {
      id: ingestionId,
      startTime: Date.now(),
      rowsProcessed: 0,
      totalRows: metadata.totalRows || -1,
      status: 'processing',
      fileName: metadata.fileName || 'unknown',
      fileSize: metadata.fileSize || 0,
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      errors: []
    });
    console.log(`Started tracking ingestion: ${ingestionId}`);
  },
  
  /**
   * Update the progress of an ingestion
   * @param {string} ingestionId - Unique identifier for the ingestion
   * @param {Object} data - Progress data to update
   */
  updateProgress(ingestionId, data = {}) {
    const ingestion = this.activeIngestions.get(ingestionId);
    if (ingestion) {
      // Update with new data
      if (data.rowsProcessed !== undefined) {
        ingestion.rowsProcessed = data.rowsProcessed;
      }
      
      if (data.totalRows !== undefined) {
        ingestion.totalRows = data.totalRows;
      }
      
      if (data.status !== undefined) {
        ingestion.status = data.status;
      }
      
      if (data.memoryUsage !== undefined) {
        ingestion.memoryUsage = data.memoryUsage;
      }
      
      if (data.error !== undefined) {
        ingestion.errors.push(data.error);
        ingestion.status = 'error';
      }
      
      // Add timestamp of the update
      ingestion.lastUpdate = Date.now();
      
      // Calculate percentage complete if possible
      if (ingestion.totalRows > 0) {
        ingestion.percentComplete = Math.min(
          100, 
          Math.round((ingestion.rowsProcessed / ingestion.totalRows) * 100)
        );
      }
      
      return ingestion;
    } else {
      console.warn(`Attempted to update progress for unknown ingestion: ${ingestionId}`);
      return null;
    }
  },
  
  /**
   * Get the current progress of an ingestion
   * @param {string} ingestionId - Unique identifier for the ingestion
   * @returns {Object|null} - Current progress data or null if not found
   */
  getProgress(ingestionId) {
    if (!ingestionId) {
      console.warn('Requested progress without an ingestion ID');
      return { 
        type: 'progress',
        status: 'error',
        error: 'No ingestion ID provided',
        timestamp: Date.now()
      };
    }

    const ingestion = this.activeIngestions.get(ingestionId);
    if (!ingestion) {
      console.warn(`Requested progress for unknown ingestion: ${ingestionId}`);
      return { 
        type: 'progress',
        status: 'not_found',
        error: `No active ingestion found with ID: ${ingestionId}`,
        timestamp: Date.now() 
      };
    }
    
    const estimatedTotal = ingestion.totalRows > 0 
      ? ingestion.totalRows 
      : Math.max(1000, ingestion.rowsProcessed * 2);
    
    const percentComplete = ingestion.percentComplete || 
      Math.min(99, Math.round((ingestion.rowsProcessed / estimatedTotal) * 100));
    
    return {
      type: 'progress',
      id: ingestionId || 'unknown',
      current: ingestion.rowsProcessed || 0,
      total: ingestion.totalRows > 0 ? ingestion.totalRows : estimatedTotal,
      status: ingestion.status || 'processing',
      fileName: ingestion.fileName || 'unknown',
      fileSize: ingestion.fileSize || 0,
      percentComplete: isNaN(percentComplete) ? 0 : percentComplete,
      elapsedTime: Date.now() - ingestion.startTime,
      memoryUsage: ingestion.memoryUsage || { heapUsed: 0, rss: 0 },
      errors: ingestion.errors && ingestion.errors.length > 0 ? ingestion.errors : undefined,
      timestamp: Date.now()
    };
  },
  
  /**
   * Get all active ingestions
   * @returns {Array} - Array of all active ingestions
   */
  getAllIngestions() {
    return Array.from(this.activeIngestions.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  },
  
  /**
   * Mark an ingestion as completed
   * @param {string} ingestionId - Unique identifier for the ingestion
   * @param {Object} data - Completion data
   * @returns {boolean} - Whether the operation was successful
   */
  completeIngestion(ingestionId, data = {}) {
    const ingestion = this.activeIngestions.get(ingestionId);
    if (ingestion) {
      ingestion.status = data.status || 'completed';
      ingestion.completedAt = Date.now();
      ingestion.result = data.result;
      ingestion.percentComplete = 100;
      
      console.log(`Completed ingestion: ${ingestionId}`);
      
      // Keep completed ingestions in memory for a while so clients can get final status
      // Then automatically clean them up after 5 minutes
      setTimeout(() => {
        this.activeIngestions.delete(ingestionId);
        console.log(`Removed completed ingestion from memory: ${ingestionId}`);
      }, 5 * 60 * 1000);
      
      return true;
    }
    return false;
  }
};

module.exports = monitoring; 