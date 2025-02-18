const pool = require('../config/db.config');
const { buildFilterQuery, buildOptimizedCombinedQuery } = require('./queryBuilderController');
const CLAIMS_TABLE = process.env.CLAIMS_TABLE || 'claims_dummy';

// Get claims data with pagination and filtering
const getClaims = async (req, res) => {
    const client = await pool.connect();
    try {
        // Get pagination params, ensuring defaults if undefined
        const page = parseInt(req.savedFilterQuery?.page || req.query.page || req.body?.page || 1);
        const limit = parseInt(req.savedFilterQuery?.limit || req.query.limit || req.body?.limit || 10);
        const offset = (page - 1) * limit;

        // Determine which conditions to use
        let baseQuery, params, isSavedFilter = false;
        
        // Check for conditions in both POST body and query params
        const conditions = req.body.conditions || 
                         (req.query.conditions ? JSON.parse(req.query.conditions) : null);

        if (conditions) {
            // Use conditions from either POST or GET
            const { query: builtQuery, params: queryParams } = buildFilterQuery(conditions);
            baseQuery = builtQuery;
            params = queryParams;
        } else if (req.savedFilterQuery) {
            // Use saved filter query
            baseQuery = req.savedFilterQuery.baseQuery;
            params = req.savedFilterQuery.params;
            isSavedFilter = true;
        } else {
            // Default query for initial load
            baseQuery = `
                SELECT 
                    c.claim_id,
                    jsonb_agg(
                        to_jsonb(c.*)
                        ORDER BY c.line_id
                    ) as grouped_data
                FROM ${CLAIMS_TABLE} c
                GROUP BY c.claim_id
            `;
            params = [];
        }

        // Use the optimized query builder
        const combinedQuery = buildOptimizedCombinedQuery(baseQuery, conditions, limit, offset);

        // Execute the query with parameters
        const result = await client.query(combinedQuery, params);

        if (!result.rows || result.rows.length === 0) {
            return res.json({
                claims: [],
                statistics: {
                    uniqueClaimIds: 0,
                    totalRecords: 0,
                    dateRange: { min: null, max: null },
                    totalAllowedAmount: 0
                },
                pagination: {
                    total: 0,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: 0
                },
                savedFilterData: req.savedFilterData
            });
        }

        const { statistics, claims } = result.rows[0];
        const totalCount = isSavedFilter && !req.body.conditions && params[0] 
            ? params[0].length 
            : parseInt(statistics.uniqueClaimIds || 0);

        res.json({
            claims: claims || [],
            statistics: {
                uniqueClaimIds: parseInt(statistics.uniqueClaimIds),
                totalRecords: parseInt(statistics.totalRecords),
                dateRange: {
                    min: statistics.dateRange.min,
                    max: statistics.dateRange.max
                },
                totalAllowedAmount: parseFloat(statistics.totalAllowedAmount)
            },
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCount / limit)
            },
            savedFilterData: req.savedFilterData
        });

    } catch (error) {
        console.error('Error in getClaims:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message
        });
    } finally {
        client.release();
    }
};

// Get claims schema
const getClaimsSchema = async () => {
    const query = `
        SELECT 
            column_name, 
            data_type 
        FROM 
            information_schema.columns 
        WHERE 
            table_name = $1
        ORDER BY ordinal_position;
    `;
    
    try {
        const result = await pool.query(query, [CLAIMS_TABLE]);
        return result.rows;
    } catch (error) {
        console.error('Error fetching claims schema:', error);
        throw error;
    }
};

// Map Postgres types to frontend types
const mapPostgresTypeToFrontend = (postgresType) => {
    const typeMapping = {
        'character varying': 'string',
        'varchar': 'string',
        'text': 'string',
        'integer': 'number',
        'numeric': 'number',
        'decimal': 'number',
        'double precision': 'number',
        'boolean': 'boolean',
        'date': 'date',
        'timestamp': 'date',
        'timestamp with time zone': 'date',
        'timestamp without time zone': 'date'
    };

    return typeMapping[postgresType.toLowerCase()] || 'string';
};

// Get claims data types
const getClaimsDataTypes = async (req, res) => {
    try {
        const { keyColumn } = req.query;
        const schema = await getClaimsSchema();
        
        const filteredSchema = keyColumn 
            ? schema.filter(col => col.column_name !== keyColumn)
            : schema;

        res.json({
            success: true,
            data: filteredSchema.map(col => ({
                column: col.column_name,
                type: mapPostgresTypeToFrontend(col.data_type)
            }))
        });
    } catch (error) {
        console.error('Error fetching claims data types:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error', 
            details: error.message 
        });
    }
};

// Get diagnosis codes
const getDiagnosisCodes = async (req, res) => {
    const client = await pool.connect();
    try {
        const { ingestedIds } = req.body;

        if (!ingestedIds || !Array.isArray(ingestedIds) || ingestedIds.length === 0) {
            return res.status(400).json({ error: 'Invalid or empty ingested IDs array' });
        }

        const verifyQuery = `
            SELECT ingested_data_id, name, type 
            FROM ingested_data 
            WHERE ingested_data_id = ANY($1) AND type = 'lut'
        `;
        const verifyResult = await client.query(verifyQuery, [ingestedIds]);

        const query = `
            SELECT DISTINCT le.value as diagnosis_code, i.name as ingested_name, i.ingested_data_id
            FROM lut_entries le
            INNER JOIN ingested_data i ON le.ingestion_id = i.ingested_data_id
            WHERE i.ingested_data_id = ANY($1)
            AND i.type = 'lut'
            ORDER BY i.ingested_data_id, le.value
        `;

        const result = await client.query(query, [ingestedIds]);

        const groupedData = result.rows.reduce((acc, row) => {
            if (!acc[row.ingested_name]) {
                acc[row.ingested_name] = {
                    ingested_data_id: row.ingested_data_id,
                    diagnosis_codes: []
                };
            }
            acc[row.ingested_name].diagnosis_codes.push(row.diagnosis_code);
            return acc;
        }, {});

        res.json({
            success: true,
            data: groupedData
        });

    } catch (error) {
        console.error('Error fetching diagnosis codes:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
        client.release();
    }
};

module.exports = {
    getClaims,
    getClaimsSchema,
    getClaimsDataTypes,
    getDiagnosisCodes
}; 