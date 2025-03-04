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
    const fileName = file.originalname || 'unnamed_file.csv';
    
    // Get mapping ID from request body
    const { mapping_id } = req.body;
    if (!mapping_id) {
      return res.status(400).json({ error: 'Mapping ID is required' });
    }
    
    // Generate a unique ID for this ingestion
    const ingestionId = uuidv4();
    
    // Start SSE for progress updates
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // Send initial response with ingestion ID
    res.write(JSON.stringify({ 
      message: 'File upload started',
      ingestion_id: ingestionId,
      status: 'processing'
    }));
    
    // Process the CSV in the background
    processCSVBuffer(file.buffer, ingestionId)
      .then(async (data) => {
        try {
          // Prepare batches (chunks of data)
          // For simplicity, we'll use a single batch for now
          const batchSize = data.length;
          const totalBatches = 1;
          const batchNumber = 1;
          
          // Create a mock request for createIngestedData
          const ingestRequest = {
            body: {
              name: fileName,
              data: data,
              mapping_id: mapping_id,
              record_count: data.length,
              file_size_bytes: fileSize,
              batch_number: batchNumber,
              total_batches: totalBatches,
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
                
                // Don't need to send a response here as we already
                // established an SSE connection above
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
      
    return;
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
  
  if (!ingestion_id) {
    return res.status(400).json({ error: 'Ingestion ID is required' });
  }
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  const progressInterval = setInterval(() => {
    const progress = monitoring.getProgress(ingestion_id);
    
    if (!progress) {
      clearInterval(progressInterval);
      res.write(`data: ${JSON.stringify({ status: 'not_found' })}\n\n`);
      res.end();
      return;
    }
    
    res.write(`data: ${JSON.stringify(progress)}\n\n`);
    
    // If process is completed or errored, end the connection
    if (progress.status === 'completed' || progress.status === 'error') {
      clearInterval(progressInterval);
      res.end();
    }
  }, 1000); // Send updates every second
  
  // Handle client disconnect
  req.on('close', () => {
    clearInterval(progressInterval);
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