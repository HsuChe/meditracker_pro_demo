const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');
const monitoring = require('../middleware/monitoring');

// Import the existing createIngestedData function
const ingestedDataController = require('./ingestedDataController');
const { createIngestedData } = ingestedDataController;

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Middleware to handle single file upload
const uploadMiddleware = upload.single('file');

/**
 * Process CSV buffer into JSON data
 * @param {Buffer} buffer - CSV file buffer
 * @param {string} ingestionId - Unique ID for tracking progress
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} - Array of parsed CSV rows
 */
const processCSVBuffer = (buffer, ingestionId, options = {}) => {
  return new Promise((resolve, reject) => {
    const results = [];
    let rowCount = 0;
    
    // Start tracking this ingestion
    monitoring.trackIngestion(ingestionId);
    
    // Create a readable stream from buffer
    const stream = Readable.from(buffer.toString());
    
    stream
      .pipe(csv(options))
      .on('data', (data) => {
        results.push(data);
        rowCount++;
        
        // Update progress every 100 rows
        if (rowCount % 100 === 0) {
          const memoryUsage = process.memoryUsage();
          monitoring.updateProgress(ingestionId, {
            rowsProcessed: rowCount,
            memoryUsage: {
              heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
              rss: Math.round(memoryUsage.rss / 1024 / 1024)
            }
          });
        }
      })
      .on('end', () => {
        console.log(`CSV processing complete. ${rowCount} rows processed.`);
        // Update final progress
        const memoryUsage = process.memoryUsage();
        monitoring.updateProgress(ingestionId, {
          rowsProcessed: rowCount,
          memoryUsage: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            rss: Math.round(memoryUsage.rss / 1024 / 1024)
          },
          status: 'parsed'
        });
        resolve(results);
      })
      .on('error', (error) => {
        console.error('Error processing CSV:', error);
        monitoring.updateProgress(ingestionId, {
          error: error.message,
          status: 'error'
        });
        reject(error);
      });
  });
};

/**
 * Handle file upload and process CSV
 */
const handleFileUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get file details
    const file = req.file;
    const fileSize = file.size;
    const fileName = req.body.name || file.originalname || 'unnamed_file.csv';
    
    // Generate a unique ID for this ingestion
    const ingestionId = uuidv4();
    
    // Start tracking this ingestion
    monitoring.trackIngestion(ingestionId, {
      fileName,
      totalRows: -1, // Unknown until processed
      fileSize
    });
    
    console.log(`Starting file upload process for ${fileName}, size: ${fileSize} bytes, ID: ${ingestionId}`);
    
    // Process the CSV in the background
    processCSVBuffer(file.buffer, ingestionId)
      .then(async (data) => {
        try {
          // Create a mock request for createIngestedData
          const ingestRequest = {
            body: {
              name: fileName,
              data: data,
              mapping_id: req.body.mapping_id || null, // This might be undefined
              record_count: data.length,
              file_size_bytes: fileSize,
              batch_number: 1,
              total_batches: 1,
              parent_ingestion_id: null
            }
          };
          
          // Create a mock response to capture what createIngestedData returns
          const ingestResponse = {
            status: (code) => ({
              json: (data) => {
                monitoring.completeIngestion(ingestionId, {
                  status: 'completed',
                  result: data
                });
                console.log(`Ingestion completed for ${fileName}, processed ${data.records_processed || 'unknown'} records`);
              }
            })
          };
          
          // Call the existing createIngestedData function
          await createIngestedData(ingestRequest, ingestResponse);
          
        } catch (error) {
          console.error('Error in data ingestion:', error);
          monitoring.updateProgress(ingestionId, {
            error: error.message,
            status: 'error'
          });
        }
      })
      .catch((error) => {
        console.error('CSV processing error:', error);
        monitoring.updateProgress(ingestionId, {
          error: error.message,
          status: 'error'
        });
      });
      
    // Immediately return a success response with the ingestion ID
    // This way the client can start monitoring progress right away
    return res.status(201).json({
      message: 'File upload started successfully',
      ingestion_id: ingestionId,
      fileName,
      fileSize,
      totalRows: 'calculating...',
      status: 'processing'
    });
    
  } catch (error) {
    console.error('File upload error:', error);
    return res.status(500).json({ 
      error: 'File upload failed',
      details: error.message
    });
  }
};

/**
 * Handle SSE for progress updates
 */
const handleProgressStream = (req, res) => {
  const { ingestion_id } = req.query;
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send an initial message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  
  // Find the latest ingestion if no specific ID requested
  if (!ingestion_id) {
    const allIngestions = monitoring.getAllIngestions();
    // Get the most recent active ingestion
    const latestIngestion = allIngestions
      .filter(ing => ing.status === 'processing')
      .sort((a, b) => b.startTime - a.startTime)[0];
      
    if (latestIngestion) {
      console.log(`No ingestion_id provided, using latest: ${latestIngestion.id}`);
      const progressData = monitoring.getProgress(latestIngestion.id);
      res.write(`data: ${JSON.stringify(progressData)}\n\n`);
    } else {
      // No active ingestions found
      res.write(`data: ${JSON.stringify({ status: 'no_active_ingestions' })}\n\n`);
      res.end();
      return;
    }
  }
  
  const progressInterval = setInterval(() => {
    try {
      const targetId = ingestion_id || (monitoring.getAllIngestions()
        .filter(ing => ing.status === 'processing')
        .sort((a, b) => b.startTime - a.startTime)[0]?.id);
      
      if (!targetId) {
        res.write(`data: ${JSON.stringify({ status: 'no_active_ingestions' })}\n\n`);
        clearInterval(progressInterval);
        res.end();
        return;
      }
      
      const progress = monitoring.getProgress(targetId);
      
      if (!progress) {
        // Send a ping to keep the connection alive
        res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
        return;
      }
      
      // Format data in the way the frontend expects
      const formattedProgress = {
        type: 'progress',
        current: progress.current,
        total: progress.total || 0,
        status: progress.status,
        percentComplete: progress.percentComplete || 0
      };
      
      // Send the progress update
      res.write(`data: ${JSON.stringify(formattedProgress)}\n\n`);
      
      // If process is completed or errored, end the connection
      if (progress.status === 'completed' || progress.status === 'error') {
        clearInterval(progressInterval);
        // Send a final event for completion/error
        if (progress.status === 'completed') {
          res.write(`event: complete\ndata: ${JSON.stringify(progress.result || {})}\n\n`);
        } else {
          res.write(`event: error\ndata: ${JSON.stringify({ error: progress.errors })}\n\n`);
        }
        res.end();
      }
    } catch (error) {
      console.error('Error in SSE progress stream:', error);
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      clearInterval(progressInterval);
      res.end();
    }
  }, 1000); // Send updates every second
  
  // Handle client disconnect
  req.on('close', () => {
    clearInterval(progressInterval);
    console.log('Client disconnected from progress stream');
  });
};

/**
 * Simple test process endpoint for testing
 */
const handleTestProcess = (req, res) => {
  res.status(200).json({
    message: 'Test process endpoint is working',
    method: req.method,
    query: req.query,
    body: req.body
  });
};

module.exports = {
  uploadMiddleware,
  handleFileUpload,
  handleProgressStream,
  handleTestProcess
}; 