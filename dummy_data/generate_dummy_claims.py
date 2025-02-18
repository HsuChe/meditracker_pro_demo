import csv
import random
import datetime
import string
import os
import psycopg2
from collections import defaultdict
from dotenv import load_dotenv
from parameters import (
    DIAGNOSIS_CODES, PROCEDURE_CODES, REVENUE_CODES, MODIFIERS,
    STATES, INSURANCE_PLANS, ACCIDENT_TYPES, TYPE_OF_BILL_CODES,
    SOURCE_OF_ADMISSION, FIRST_NAMES, LAST_NAMES,
    generate_npi, generate_phone, generate_tax_id,
    generate_policy_number, generate_account_number
)

# Load environment variables
load_dotenv()

# Cache for schema information
_SCHEMA_CACHE = None

def get_table_schema():
    """Get complete schema information for claims_dummy table including constraints."""
    global _SCHEMA_CACHE
    
    # Return cached schema if available
    if _SCHEMA_CACHE is not None:
        return _SCHEMA_CACHE
        
    try:
        print("Attempting to connect to database...")
        print(f"DB: {os.getenv('POSTGRES_DB')}")
        print(f"User: {os.getenv('POSTGRES_USER')}")
        print(f"Host: {os.getenv('POSTGRES_HOST')}")
        print(f"Port: {os.getenv('POSTGRES_PORT')}")
        
        conn = psycopg2.connect(
            dbname=os.getenv('POSTGRES_DB'),
            user=os.getenv('POSTGRES_USER'),
            password=os.getenv('POSTGRES_PASSWORD'),
            host=os.getenv('POSTGRES_HOST'),
            port=os.getenv('POSTGRES_PORT')
        )
        
        print("Successfully connected to database")
        cursor = conn.cursor()
        
        # Get column information
        column_query = """
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                numeric_precision,
                numeric_scale,
                is_nullable,
                column_default,
                col_description((table_schema || '.' || table_name)::regclass, ordinal_position) as description
            FROM 
                information_schema.columns 
            WHERE 
                table_name = 'claims_dummy'
            ORDER BY 
                ordinal_position;
        """
        
        # Get check constraints
        constraint_query = """
            SELECT
                con.conname as constraint_name,
                pg_get_constraintdef(con.oid) as constraint_definition
            FROM
                pg_constraint con
                INNER JOIN pg_class rel ON rel.oid = con.conrelid
                INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE
                rel.relname = 'claims_dummy'
                AND con.contype = 'c';
        """
        
        # Get foreign key constraints
        fk_query = """
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM
                information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
            WHERE
                tc.table_name = 'claims_dummy'
                AND tc.constraint_type = 'FOREIGN KEY';
        """
        
        try:
            # Execute queries
            cursor.execute(column_query)
            columns = cursor.fetchall()
            
            cursor.execute(constraint_query)
            constraints = cursor.fetchall()
            
            cursor.execute(fk_query)
            foreign_keys = cursor.fetchall()
            
            # Build schema dictionary
            schema = {
                'columns': {},
                'constraints': [],
                'foreign_keys': []
            }
            
            # Process columns
            for col in columns:
                schema['columns'][col[0]] = {
                    'data_type': col[1],
                    'max_length': col[2],
                    'numeric_precision': col[3],
                    'numeric_scale': col[4],
                    'is_nullable': col[5] == 'YES',
                    'default_value': col[6],
                    'description': col[7]
                }
            
            # Process constraints
            for con in constraints:
                schema['constraints'].append({
                    'name': con[0],
                    'definition': con[1]
                })
            
            # Process foreign keys
            for fk in foreign_keys:
                schema['foreign_keys'].append({
                    'name': fk[0],
                    'column': fk[1],
                    'foreign_table': fk[2],
                    'foreign_column': fk[3]
                })
            
            # Cache the schema
            _SCHEMA_CACHE = schema
            return schema
            
        except Exception as e:
            print(f"Error executing queries: {str(e)}")
            raise
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        print(f"Error getting schema info: {str(e)}")
        print(f"Error type: {type(e)}")
        print(f"Error args: {e.args}")
        return None

# Parameters for dummy data generation
NUM_ROWS = 100000  # Number of rows to generate
MAX_LINE_ID = 10  # Maximum line_id value
LOW_LINE_ID_THRESHOLD = 5  # Threshold for 80% of line_ids
LOW_LINE_ID_PROBABILITY = 0.8  # Probability of generating line_ids below threshold

# Helper functions to generate dummy data
def random_date(start, end):
    """Generate a random date between start and end."""
    return start + datetime.timedelta(days=random.randint(0, (end - start).days))

def random_string(length=5):
    """Generate a random string of uppercase letters."""
    return ''.join(random.choices(string.ascii_uppercase, k=length))

def random_claim_id(length=8):
    """Generate a random string of uppercase letters and digits for claim ID."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

def generate_line_id_count():
    """Generate the number of line_ids for a claim based on the specified distribution."""
    if random.random() < LOW_LINE_ID_PROBABILITY:
        return random.randint(1, LOW_LINE_ID_THRESHOLD - 1)
    else:
        return random.randint(LOW_LINE_ID_THRESHOLD, MAX_LINE_ID)

def clean_numeric_value(value):
    """Clean numeric values to ensure they're either valid numbers or None, never empty strings."""
    if value is None or value == "":
        return None
    try:
        return float(value) if isinstance(value, (str, int, float)) else None
    except (ValueError, TypeError):
        return None

def clean_integer_value(value, min_val=None, max_val=None):
    """Clean integer values and ensure they're within specified range."""
    if value is None or value == "":
        return None
    try:
        val = int(float(value)) if isinstance(value, (str, int, float)) else None
        if min_val is not None and val < min_val:
            return None
        if max_val is not None and val > max_val:
            return None
        return val
    except (ValueError, TypeError):
        return None

def get_schema_info():
    """Get schema information from PostgreSQL database."""
    try:
        conn = psycopg2.connect(
            dbname=os.getenv('POSTGRES_DB'),
            user=os.getenv('POSTGRES_USER'),
            password=os.getenv('POSTGRES_PASSWORD'),
            host=os.getenv('POSTGRES_HOST'),
            port=os.getenv('POSTGRES_PORT')
        )
        
        cursor = conn.cursor()
        
        # Query to get column information
        query = """
            SELECT 
                column_name, 
                data_type,
                is_nullable,
                column_default,
                col_description((table_schema || '.' || table_name)::regclass, ordinal_position) as description
            FROM 
                information_schema.columns 
            WHERE 
                table_name = 'claims_dummy'
            ORDER BY ordinal_position;
        """
        
        cursor.execute(query)
        schema_info = cursor.fetchall()
        
        # Convert to dictionary for easier access
        schema_dict = {
            row[0]: {
                'data_type': row[1],
                'is_nullable': row[2] == 'YES',
                'default_value': row[3],
                'description': row[4]
            }
            for row in schema_info
        }
        
        cursor.close()
        conn.close()
        
        return schema_dict
    except Exception as e:
        print(f"Error getting schema info: {e}")
        return None

def clean_value_by_schema(value, schema_info):
    """Clean a value based on its schema data type."""
    if value is None or value == "":
        return None
        
    data_type = schema_info['data_type']
    
    try:
        if data_type == 'boolean':
            if isinstance(value, bool):
                return value
            if isinstance(value, (int, float)):
                return bool(value)
            if isinstance(value, str):
                return value.lower() in ('true', 't', '1', 'yes', 'y')
            return None
            
        elif data_type in ('integer', 'bigint', 'smallint'):
            return int(float(value)) if isinstance(value, (str, int, float)) else None
            
        elif data_type in ('numeric', 'decimal', 'real', 'double precision'):
            return float(value) if isinstance(value, (str, int, float)) else None
            
        elif data_type == 'date':
            if isinstance(value, datetime.date):
                return value
            if isinstance(value, str):
                return datetime.datetime.strptime(value, "%Y-%m-%d").date()
            return None
            
        elif data_type == 'timestamp':
            if isinstance(value, datetime.datetime):
                return value
            if isinstance(value, str):
                return datetime.datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
            return None
            
        elif data_type.startswith(('character varying', 'varchar', 'char')):
            if not isinstance(value, str):
                value = str(value)
            # Extract length if specified in type
            if '(' in data_type and ')' in data_type:
                try:
                    length = int(data_type.split('(')[1].split(')')[0])
                    return value[:length]
                except (IndexError, ValueError):
                    return value
            return value
            
        return value
        
    except (ValueError, TypeError):
        return None

def generate_base_claim_data():
    """Generate the base claim data without line_id."""
    # Get schema information
    schema = get_table_schema()
    if not schema:
        raise Exception("Failed to get schema information from database")

    start_date = datetime.date(2020, 1, 1)
    end_date = datetime.date(2025, 12, 31)
    form_type = random.choice(list(DIAGNOSIS_CODES.keys()))
    
    # Generate admission date first
    admission_date = random_date(start_date, end_date)
    # Generate discharge date after admission date
    discharge_date = random_date(admission_date, end_date)
    # Generate service date between admission and discharge
    service_date = random_date(admission_date, discharge_date)
    
    # Generate diagnosis codes (primary + additional)
    all_diagnosis_codes = [random.choice(DIAGNOSIS_CODES[form_type]) for _ in range(12)]
    
    # Generate condition and occurrence codes with proper NULL handling and range constraints
    condition_codes = [random.randint(1, 99) if random.random() > 0.5 else None for _ in range(10)]
    occurrence_codes = [random.randint(1, 99) if random.random() > 0.5 else None for _ in range(4)]
    
    # Generate lab service charge with proper decimal precision - never NULL
    lab_charge = round(random.uniform(0.0, 1000.0), 2) if random.random() > 0.3 else 0.00

    # Generate type_of_bill that meets the constraint (between 110 and 859)
    type_of_bill = random.choice(TYPE_OF_BILL_CODES)
    while not (110 <= int(type_of_bill) <= 859):
        type_of_bill = random.choice(TYPE_OF_BILL_CODES)
    # Ensure type_of_bill is exactly 3 characters
    type_of_bill = str(type_of_bill).zfill(3)[:3]

    # Generate source_of_admission that meets the pattern [1-9A-F]
    source_of_admission = random.choice(SOURCE_OF_ADMISSION)
    
    base_data = {
        # Core fields with proper constraints
        "claim_id": random_claim_id(8),  # VARCHAR(8)
        "patient_id": random.randint(1000, 9999),
        "date_of_birth": random_date(datetime.date(1950, 1, 1), datetime.date(2010, 12, 31)).strftime("%Y-%m-%d"),
        "gender": random.choice(["Male", "Female"]),  # Full gender strings
        "provider_id": random.randint(100, 500),
        "facility_id": random.randint(1, 50),
        "diagnosis_code": all_diagnosis_codes[0],  # Primary diagnosis
        "procedure_code": random.choice(PROCEDURE_CODES[form_type]),
        "admission_date": admission_date.strftime("%Y-%m-%d"),
        "discharge_date": discharge_date.strftime("%Y-%m-%d"),
        "revenue_code": str(random.choice(REVENUE_CODES[form_type])).zfill(3)[:3],  # Ensure 3 characters
        "modifiers": random.choice(MODIFIERS[form_type]),
        "claim_type": form_type,
        
        # Place of Service (integer 1-99)
        "place_of_service": random.randint(1, 99),
        
        # Patient Information with proper constraints
        "patient_policy_number": generate_policy_number(),
        "patient_name_first": random.choice(FIRST_NAMES),
        "patient_name_last": random.choice(LAST_NAMES),
        "patient_address_state": random.choice(STATES),
        "patient_account_number": generate_account_number(),
        "employment_status": random.choice([True, False]),
        
        # Insurance Information
        "insurance_plan": random.choice(INSURANCE_PLANS),
        "secondary_insurance": random.choice([True, False]),
        "accept_assignment": random.choice([True, False]),
        
        # Accident Information (constrained to allowed values)
        "accident_type": random.choice(ACCIDENT_TYPES),
        
        # Provider Information
        "referring_provider_npi": generate_npi(),
        "rendering_provider_npi": generate_npi(),
        "tax_id": generate_tax_id(),
        
        # Service Facility Information
        "service_facilities_state": random.choice(STATES),
        "service_facilities_npi": generate_npi(),
        
        # Billing Provider Information
        "billing_provider_phone": generate_phone(),
        "billing_provider_npi": generate_npi(),
        
        # Laboratory Information
        "outside_lab": random.choice([True, False]),
        "lab_service_charge": lab_charge,
        
        # Additional Diagnosis Codes
        **{f"diagnosis_code_{i+2}": code for i, code in enumerate(all_diagnosis_codes[1:])},
        "diagnosis_pointers": ','.join(map(str, random.sample(range(1, 13), random.randint(1, 4)))),
        
        # Authorization Information
        "prior_auth_number": random.choice([True, False]),
        
        # Service Information
        "date_of_service": service_date.strftime("%Y-%m-%d %H:%M:%S"),
        "emg_indicator": 1 if random.random() < 0.2 else None,  # Only 1 or NULL
        "units_days": random.randint(1, 30),
        
        # Bill Information with constraints
        "type_of_bill": type_of_bill,
        "type_of_admission_visit": random.randint(1, 9),
        "source_of_admission": source_of_admission[:1],  # Ensure only one character
        
        # Condition Codes (1-10) with proper range enforcement
        **{f"condition_code_{i+1}": code for i, code in enumerate(condition_codes)},
        
        # Occurrence Codes (1-4) with proper range enforcement
        **{f"occurrence_code_{i+1}": code for i, code in enumerate(occurrence_codes)},
    }

    # Ensure numeric fields are never NULL
    for field, value in base_data.items():
        if field in schema['columns']:
            col_info = schema['columns'][field]
            
            # Convert NULL to 0 for numeric fields, except condition and occurrence codes
            if value is None and col_info['data_type'] in ('numeric', 'decimal', 'integer', 'bigint', 'smallint'):
                if any(field.startswith(prefix) for prefix in ['condition_code_', 'occurrence_code_']):
                    base_data[field] = None  # Keep NULL for condition and occurrence codes
                else:
                    base_data[field] = 0  # Convert to 0 for other numeric fields
            
            # Handle string length constraints
            if value is not None and col_info['data_type'].startswith('character varying'):
                max_length = col_info['max_length']
                if max_length and len(str(value)) > max_length:
                    base_data[field] = str(value)[:max_length]
            
            # Handle numeric precision
            if value is not None and col_info['data_type'] in ('numeric', 'decimal'):
                if col_info['numeric_scale']:
                    base_data[field] = round(float(value), col_info['numeric_scale'])

    return base_data

def generate_line_charge(procedure_code):
    """Generate a realistic line charge based on the procedure code."""
    # Base charges for different procedure code ranges
    if procedure_code.startswith(('99', '90')):  # Office visits, vaccinations
        base = random.uniform(50, 300)
    elif procedure_code.startswith(('70', '71', '72', '73', '74')):  # Radiology
        base = random.uniform(200, 2000)
    elif procedure_code.startswith(('27', '29', '33')):  # Surgery
        base = random.uniform(1000, 10000)
    elif procedure_code.startswith(('80', '81', '82', '83', '84', '85', '86', '87')):  # Lab tests
        base = random.uniform(20, 500)
    else:  # Other procedures
        base = random.uniform(100, 1500)
    
    # Add some random variation (±20%)
    variation = random.uniform(0.8, 1.2)
    charge = round(base * variation, 2)
    
    # Ensure we never return 0 or None for charges
    return max(0.01, charge)  # Minimum charge of 1 cent

def generate_dummy_data(num_rows):
    """Generate dummy data with properly distributed line_ids."""
    # Get schema information
    schema = get_table_schema()
    if not schema:
        print("Warning: Could not get schema info from database. Using default data types.")
    
    data = []
    current_rows = 0
    
    while current_rows < num_rows:
        try:
            # Generate a new claim
            claim_id = random_claim_id(8)  # Ensure 8 characters
            num_lines = generate_line_id_count()
            base_claim_data = generate_base_claim_data()
            
            # Generate procedure codes and their associated charges for all lines
            procedure_codes = [random.choice(PROCEDURE_CODES[base_claim_data["claim_type"]]) 
                             for _ in range(num_lines)]
            
            # Generate line charges with proper decimal precision - never NULL
            line_charges = [generate_line_charge(proc_code) for proc_code in procedure_codes]
            total_charges = round(sum(line_charges), 2)
            
            # Update base claim data with total charges
            base_claim_data["total_charges"] = total_charges
            
            # Calculate allowed amount based on insurance plan with proper decimal precision
            if base_claim_data["insurance_plan"] == "Medicare":
                allowed_ratio = random.uniform(0.7, 0.8)
            elif base_claim_data["insurance_plan"] in ["Blue Cross", "UnitedHealth", "Aetna"]:
                allowed_ratio = random.uniform(0.6, 0.85)
            elif base_claim_data["insurance_plan"] == "Medicaid":
                allowed_ratio = random.uniform(0.5, 0.7)
            else:
                allowed_ratio = random.uniform(0.5, 0.9)
                
            base_claim_data["allowed_amount"] = max(0.01, round(total_charges * allowed_ratio, 2))
            
            # Generate all required line items for this claim
            for line_id, (line_charge, proc_code) in enumerate(zip(line_charges, procedure_codes), 1):
                if base_claim_data["secondary_insurance"]:
                    payment_ratio = random.uniform(0.7, 0.95)
                else:
                    payment_ratio = random.uniform(0.5, 0.8)
                    
                amount_paid = max(0.01, round(line_charge * payment_ratio, 2))
                balance_due = max(0.00, round(line_charge - amount_paid, 2))
                
                row = {
                    "claim_id": claim_id,
                    "line_id": str(line_id).zfill(4),  # Ensure consistent format
                    "procedure_code": proc_code,
                    **base_claim_data,
                    "line_charges": line_charge,
                    "amount_paid": amount_paid,
                    "balance_due": balance_due
                }
                
                # Validate numeric fields against schema and ensure no NULLs
                if schema:
                    for field, value in row.items():
                        if field in schema['columns']:
                            col_info = schema['columns'][field]
                            
                            # Convert NULL to 0 for numeric fields, except condition and occurrence codes
                            if value is None and col_info['data_type'] in ('numeric', 'decimal', 'integer', 'bigint', 'smallint'):
                                if any(field.startswith(prefix) for prefix in ['condition_code_', 'occurrence_code_']):
                                    row[field] = None  # Keep NULL for condition and occurrence codes
                                else:
                                    row[field] = 0  # Convert to 0 for other numeric fields
                            
                            # Handle numeric precision for financial fields
                            if value is not None and col_info['data_type'] in ('numeric', 'decimal'):
                                if col_info['numeric_scale']:
                                    row[field] = round(float(value), col_info['numeric_scale'])
                
                data.append(row)
                current_rows += 1
                
                if current_rows >= num_rows:
                    break
                    
        except ValueError as e:
            print(f"Warning: Skipping invalid record: {str(e)}")
            continue
    
    return data[:num_rows]

def validate_data(data):
    """Validate that the generated data meets all requirements."""
    claim_lines = defaultdict(list)
    for row in data:
        claim_lines[row["claim_id"]].append(int(row["line_id"]))
    
    # Validate line_id continuity and distribution
    total_claims = len(claim_lines)
    claims_below_threshold = sum(1 for lines in claim_lines.values() if max(lines) < LOW_LINE_ID_THRESHOLD)
    distribution_percentage = claims_below_threshold / total_claims
    
    print(f"Validation Results:")
    print(f"Total claims: {total_claims}")
    print(f"Claims with line_id < {LOW_LINE_ID_THRESHOLD}: {claims_below_threshold} ({distribution_percentage:.2%})")
    print(f"Target distribution: {LOW_LINE_ID_PROBABILITY:.2%}")
    
    # Validate continuous line_ids
    for claim_id, lines in claim_lines.items():
        max_line = max(lines)
        expected_lines = set(range(1, max_line + 1))
        actual_lines = set(lines)
        if expected_lines != actual_lines:
            print(f"Warning: Claim {claim_id} has non-continuous line_ids")
            print(f"Expected: {expected_lines}")
            print(f"Actual: {actual_lines}")

def export_to_csv(filename, data):
    """Write data to a CSV file."""
    if data:
        keys = data[0].keys()
        
        # Get schema information for type checking
        schema = get_table_schema()
        
        # Clean data before writing
        cleaned_data = []
        for row in data:
            cleaned_row = {}
            for key, value in row.items():
                # Check if field is numeric based on schema
                is_numeric = False
                if schema and key in schema['columns']:
                    data_type = schema['columns'][key]['data_type']
                    is_numeric = data_type in ('numeric', 'decimal', 'integer', 'bigint', 'smallint')
                
                if value is None:
                    # Special handling for condition codes and occurrence codes
                    if key.startswith(('condition_code_', 'occurrence_code_')):
                        cleaned_row[key] = ''  # Use empty string for NULL condition/occurrence codes
                    # Special handling for emg_indicator (must be 1 or NULL)
                    elif key == 'emg_indicator':
                        cleaned_row[key] = ''  # Use empty string for NULL
                    # Special handling for type_of_admission_visit (must be 1-9 or NULL)
                    elif key == 'type_of_admission_visit':
                        cleaned_row[key] = ''  # Use empty string for NULL
                    # For other numeric fields, use '0' instead of empty string
                    elif is_numeric:
                        cleaned_row[key] = '0'
                    else:
                        cleaned_row[key] = ''
                else:
                    # Special handling for condition codes and occurrence codes
                    if key.startswith(('condition_code_', 'occurrence_code_')):
                        # Ensure value is between 1-99 or NULL
                        try:
                            val = int(value)
                            if val < 1 or val > 99:
                                cleaned_row[key] = ''  # Use empty string for invalid values
                            else:
                                cleaned_row[key] = value
                        except (ValueError, TypeError):
                            cleaned_row[key] = ''  # Use empty string for non-integer values
                    # Special handling for emg_indicator (must be 1 or NULL)
                    elif key == 'emg_indicator':
                        try:
                            val = int(value)
                            if val == 1:
                                cleaned_row[key] = value
                            else:
                                cleaned_row[key] = ''  # Use empty string for any value that's not 1
                        except (ValueError, TypeError):
                            cleaned_row[key] = ''  # Use empty string for non-integer values
                    # Special handling for type_of_admission_visit (must be 1-9 or NULL)
                    elif key == 'type_of_admission_visit':
                        try:
                            val = int(value)
                            if 1 <= val <= 9:
                                cleaned_row[key] = value
                            else:
                                cleaned_row[key] = ''  # Use empty string for values outside 1-9
                        except (ValueError, TypeError):
                            cleaned_row[key] = ''  # Use empty string for non-integer values
                    else:
                        cleaned_row[key] = value
            cleaned_data.append(cleaned_row)
        
        with open(filename, "w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=keys)
            writer.writeheader()
            writer.writerows(cleaned_data)

# Generate and export dummy data
data = generate_dummy_data(NUM_ROWS)
validate_data(data)

# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))
output_filename = f"dummy_medical_data {NUM_ROWS}.csv"
output_path = os.path.join(script_dir, output_filename)

export_to_csv(output_path, data)
print(f"\n{NUM_ROWS} rows of dummy medical data have been generated and saved to '{output_filename}'")
print(f"File location: {output_path}")