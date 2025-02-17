import os
import csv
import pandas as pd
import numpy as np
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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

def get_char_length(data_type):
    """Extract the length from a character type definition."""
    try:
        if '(' in data_type and ')' in data_type:
            length_str = data_type.split('(')[1].split(')')[0]
            return int(length_str)
    except (IndexError, ValueError):
        pass
    return None

def create_clean_csv(input_file, output_file='clean_claims_data.csv'):
    """Process CSV data with column-based approach using pandas."""
    try:
        # Get schema information
        schema_info = get_schema_info()
        if not schema_info:
            raise Exception("Failed to get schema information from database")

        # Initialize data quality report
        quality_report = {
            'total_rows': 0,
            'columns': {},
            'constraints_violated': [],
            'null_counts': {},
            'invalid_values': {}
        }

        # Read the CSV file into a pandas DataFrame
        df = pd.read_csv(input_file)
        quality_report['total_rows'] = len(df)
        print(f"Total rows to process: {len(df)}")

        # Process each column based on its data type from the schema
        for column in df.columns:
            if column in schema_info:
                data_type = schema_info[column]['data_type']
                print(f"\nProcessing column: {column} (Type: {data_type})")
                
                # Initialize column report
                quality_report['columns'][column] = {
                    'data_type': data_type,
                    'null_count': df[column].isna().sum(),
                    'unique_values': df[column].nunique(),
                    'sample_values': df[column].unique()[:5].tolist(),
                    'issues': []
                }
                
                # Store null counts
                quality_report['null_counts'][column] = df[column].isna().sum()

                # Check specific constraints
                if column == 'type_of_bill':
                    invalid_bills = df[df['type_of_bill'].notna()][
                        ~df['type_of_bill'].astype(str).str.match(r'^[1-8][1-5][0-9]$') |
                        (df['type_of_bill'].astype(str).astype(int) < 110) |
                        (df['type_of_bill'].astype(str).astype(int) > 859)
                    ]
                    if not invalid_bills.empty:
                        quality_report['constraints_violated'].append(
                            f"type_of_bill: {len(invalid_bills)} values outside 110-859 range"
                        )
                        quality_report['invalid_values']['type_of_bill'] = invalid_bills['type_of_bill'].unique().tolist()

                elif column == 'source_of_admission':
                    invalid_sources = df[df['source_of_admission'].notna()][
                        ~df['source_of_admission'].astype(str).str.match(r'^[1-9A-F]$')
                    ]
                    if not invalid_sources.empty:
                        quality_report['constraints_violated'].append(
                            f"source_of_admission: {len(invalid_sources)} values not matching pattern [1-9A-F]"
                        )
                        quality_report['invalid_values']['source_of_admission'] = invalid_sources['source_of_admission'].unique().tolist()

                # Handle different data types
                if data_type == 'boolean':
                    # Convert to string first to handle all cases uniformly
                    df[column] = df[column].astype(str)
                    
                    # Map values to booleans or None
                    df[column] = df[column].apply(lambda x: 
                        None if pd.isna(x) or x.lower() == 'nan' or x.strip() == ''
                        else True if x.lower() in ('true', 't', '1', 'yes', 'y')
                        else False if x.lower() in ('false', 'f', '0', 'no', 'n')
                        else None)  # Any other value becomes None
                    
                    # Verify the cleanup
                    remaining_values = df[column].unique()
                    print(f"After cleanup, unique values: {remaining_values}")
                    # Check for any values that are not None and not boolean
                    problematic = [v for v in remaining_values if v is not None and not isinstance(v, (bool, np.bool_))]
                    if problematic:
                        raise ValueError(f"Column {column} still has non-boolean values: {problematic}")
                        
                    # Check for invalid boolean values
                    invalid_bools = df[~df[column].isna() & ~df[column].astype(str).str.lower().isin(['true', 'false', 't', 'f', '1', '0', 'yes', 'no', 'y', 'n'])]
                    if not invalid_bools.empty:
                        quality_report['columns'][column]['issues'].append(
                            f"Found {len(invalid_bools)} invalid boolean values"
                        )
                        quality_report['invalid_values'][column] = invalid_bools[column].unique().tolist()

                elif data_type in ('integer', 'bigint', 'smallint'):
                    # Special handling for emg_indicator
                    if column == 'emg_indicator':
                        # Convert to integer first
                        df[column] = pd.to_numeric(df[column], errors='coerce')
                        # Only allow 1 or NULL
                        df[column] = df[column].apply(lambda x: 1 if x == 1 else None)
                        print(f"After emg_indicator cleanup, unique values: {df[column].unique()}")
                    else:
                        # Convert to integer, handling NaN values
                        df[column] = pd.to_numeric(df[column], errors='coerce').astype('Int64')
                elif data_type in ('numeric', 'decimal', 'real', 'double precision'):
                    # Convert to float, handling NaN values and empty strings
                    df[column] = df[column].replace('', np.nan)
                    df[column] = pd.to_numeric(df[column], errors='coerce')
                    # Print unique values for debugging
                    print(f"After numeric cleanup, unique values sample: {df[column].dropna().sample(min(5, len(df[column].dropna()))).tolist()}")
                elif data_type == 'date':
                    # Convert to date format
                    df[column] = pd.to_datetime(df[column], errors='coerce').dt.date
                elif data_type == 'timestamp':
                    # Convert to timestamp format
                    df[column] = pd.to_datetime(df[column], errors='coerce')
                elif data_type.startswith(('character varying', 'varchar', 'char')):
                    # Clean string values and handle nulls
                    df[column] = df[column].astype(str)
                    df[column] = df[column].replace(r'^\s*$', np.nan, regex=True)
                    df[column] = df[column].replace('nan', np.nan)
                    
                    # Get length constraint if any
                    length = get_char_length(data_type)
                    if length is not None:
                        print(f"Truncating strings to length: {length}")
                        df[column] = df[column].apply(lambda x: x[:length] if isinstance(x, str) else x)

        # Write quality report
        report_file = f"{output_file}_quality_report.txt"
        with open(report_file, 'w') as f:
            f.write("Data Quality Report\n")
            f.write("==================\n\n")
            f.write(f"Total Rows Processed: {quality_report['total_rows']}\n\n")
            
            f.write("Constraint Violations:\n")
            f.write("----------------------\n")
            for violation in quality_report['constraints_violated']:
                f.write(f"- {violation}\n")
            f.write("\n")
            
            f.write("Column Statistics:\n")
            f.write("-----------------\n")
            for col, stats in quality_report['columns'].items():
                f.write(f"\n{col}:\n")
                f.write(f"  Data Type: {stats['data_type']}\n")
                f.write(f"  Null Count: {stats['null_count']}\n")
                f.write(f"  Unique Values: {stats['unique_values']}\n")
                f.write(f"  Sample Values: {stats['sample_values']}\n")
                if stats['issues']:
                    f.write("  Issues:\n")
                    for issue in stats['issues']:
                        f.write(f"    - {issue}\n")
                if col in quality_report['invalid_values']:
                    f.write(f"  Invalid Values Found: {quality_report['invalid_values'][col]}\n")

        print(f"\nData quality report saved to {report_file}")
        
        # Export the cleaned data to CSV, using NULL for missing values
        df.to_csv(output_file, index=False, na_rep='NULL')
        print(f"\nProcessed data saved to {output_file}")
        
    except Exception as e:
        print(f"Error processing CSV: {e}")
        raise

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python etl_claims.py <input_csv_file> [output_csv_file]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'clean_claims_data.csv'
    create_clean_csv(input_file, output_file) 