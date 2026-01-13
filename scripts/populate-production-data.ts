/**
 * Production Data Population Script
 * 
 * This script populates the production database with:
 * - Spot types
 * - Departments
 * - Users (from Excel data)
 * - Parking spots
 * - Spot assignments
 * 
 * Usage: Run this script with your production DATABASE_URL
 * 
 * IMPORTANT: This is for production database only.
 * Set PRODUCTION_DATABASE_URL environment variable before running.
 */

import { neon } from '@neondatabase/serverless';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

interface ExcelRow {
  'STALL ': number;
  'SPOT': string;
  'FIRST NAME LAST NAME'?: string;
  'DEPARTMENT'?: string;
  'SPOT DESCRIPTION'?: string;
}

function generateEmail(name: string): string {
  const cleaned = name.trim().toLowerCase();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[parts.length - 1]}@bci.ca`;
  }
  return `${parts[0]}@bci.ca`;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    };
  }
  return { firstName: fullName.trim(), lastName: '' };
}

function normalizeDepartment(dept: string | undefined): string {
  if (!dept) return 'General';
  const cleaned = dept.trim();
  
  const mappings: Record<string, string> = {
    'IRR': 'Infrastructure & Renewable Resources',
    'ISR': 'Investment Strategy & Risk',
    'CIR': 'Corporate Investment Risk',
    'COO': 'Corporate Operations',
    'CRA': 'Credit Risk & Analytics',
    'CR&A': 'Credit Risk & Analytics',
    'HR': 'Human Resources',
    'Finance ': 'Finance',
    'Legal ': 'Legal',
    'Legal Affairs': 'Legal Affairs & General Counsel',
    'Technology ': 'Technology',
    'Capital Markets & Credit Investments ': 'Capital Markets & Credit Investments',
    'Office of the CEO/ CIO': 'Office of the CEO',
    'Senior Anylyst, Payments & Banking': 'Finance',
    'only for the month of January then Sarah Fung ': 'General',
    'for the month of January then WPS': 'General',
  };
  
  return mappings[cleaned] || cleaned;
}

function getSpotTypeSlug(description: string | undefined): string {
  if (!description) return 'regular';
  const desc = description.toLowerCase().trim();
  
  if (desc.includes('tesla')) return 'tesla-chargers';
  if (desc.includes('electric') || desc.includes('ev')) return 'ev-chargers';
  if (desc.includes('wheelchair') || desc.includes('accessible')) return 'accessible';
  if (desc.includes('ceo') || desc.includes('coo') || desc.includes('evp') || desc.includes('svp') || desc.includes('board')) return 'reserved';
  
  return 'regular';
}

async function readExcelFile(): Promise<ExcelRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(process.cwd(), 'attached_assets/Parking_Spot_Allocation_for_Lijin_1766018327520.xlsx'));
  
  const worksheet = workbook.getWorksheet('Sheet1');
  if (!worksheet) {
    throw new Error('Sheet1 not found in workbook');
  }
  
  const data: ExcelRow[] = [];
  const headers: string[] = [];
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || '');
      });
    } else {
      const rowData: any = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      if (Object.keys(rowData).length > 0) {
        data.push(rowData as ExcelRow);
      }
    }
  });
  
  return data;
}

function generateSQL(data: ExcelRow[]): string {
  const departments = [...new Set(
    data
      .map(r => normalizeDepartment(r['DEPARTMENT']))
      .filter(d => d && d !== 'General')
  )].sort();

  const usersMap = new Map<string, { firstName: string; lastName: string; email: string; department: string }>();
  data.forEach(row => {
    const name = row['FIRST NAME LAST NAME']?.toString().trim();
    if (name) {
      const email = generateEmail(name);
      const { firstName, lastName } = splitName(name);
      usersMap.set(email, {
        firstName,
        lastName,
        email,
        department: normalizeDepartment(row['DEPARTMENT'])
      });
    }
  });
  const users = Array.from(usersMap.values());

  const spots = data.map(row => {
    const name = row['FIRST NAME LAST NAME']?.toString().trim();
    return {
      stallNumber: row['STALL '],
      spotCode: row['SPOT'],
      spotTypeSlug: getSpotTypeSlug(row['SPOT DESCRIPTION']),
      assignedUserEmail: name ? generateEmail(name) : null,
      description: row['SPOT DESCRIPTION']?.toString().trim() || null
    };
  });

  const lines: string[] = [];
  
  lines.push('-- ============================================');
  lines.push('-- BCI ParkShare Production Data Population Script');
  lines.push('-- Generated: ' + new Date().toISOString());
  lines.push('-- ============================================');
  lines.push('');
  lines.push('-- IMPORTANT: Review this script before running!');
  lines.push('-- This will insert data into your production database.');
  lines.push('');
  
  lines.push('-- ============================================');
  lines.push('-- 1. SPOT TYPES');
  lines.push('-- ============================================');
  lines.push(`
INSERT INTO spot_types (name, slug, description, is_active) VALUES
  ('Regular', 'regular', 'Standard parking spot', true),
  ('EV Chargers', 'ev-chargers', 'Electric vehicle charging station', true),
  ('Tesla Chargers', 'tesla-chargers', 'Tesla-specific charging station', true),
  ('Accessible', 'accessible', 'Wheelchair accessible parking', true),
  ('Reserved', 'reserved', 'Reserved for executives/special use', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;
`);
  
  lines.push('-- ============================================');
  lines.push('-- 2. DEPARTMENTS');
  lines.push('-- ============================================');
  departments.forEach(dept => {
    const safeDept = dept.replace(/'/g, "''");
    lines.push(`INSERT INTO departments (name) VALUES ('${safeDept}') ON CONFLICT (name) DO NOTHING;`);
  });
  lines.push('');
  
  lines.push('-- ============================================');
  lines.push('-- 3. USERS');
  lines.push('-- ============================================');
  lines.push('-- Note: Users will be created with placeholder data.');
  lines.push('-- They will be fully populated when they log in via OIDC.');
  lines.push('');
  
  users.forEach(user => {
    const safeFirstName = user.firstName.replace(/'/g, "''");
    const safeLastName = user.lastName.replace(/'/g, "''");
    const safeDept = user.department.replace(/'/g, "''");
    lines.push(`
INSERT INTO users (id, email, first_name, last_name, roles, department_id, status, created_at)
VALUES (
  gen_random_uuid(),
  '${user.email}',
  '${safeFirstName}',
  '${safeLastName}',
  ARRAY['owner', 'renter']::text[],
  (SELECT id FROM departments WHERE name = '${safeDept}' LIMIT 1),
  'active',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  first_name = COALESCE(users.first_name, EXCLUDED.first_name),
  last_name = COALESCE(users.last_name, EXCLUDED.last_name),
  roles = CASE 
    WHEN 'owner' = ANY(users.roles) THEN users.roles
    ELSE array_append(users.roles, 'owner')
  END,
  department_id = COALESCE(users.department_id, EXCLUDED.department_id);`);
  });
  lines.push('');
  
  lines.push('-- ============================================');
  lines.push('-- 4. PARKING SPOTS');
  lines.push('-- ============================================');
  lines.push('-- Note: All spots are at Victoria location (location_id = 1)');
  lines.push('-- Adjust location_id if needed for your setup.');
  lines.push('');
  
  spots.forEach(spot => {
    const desc = spot.description ? `'${spot.description.replace(/'/g, "''")}'` : 'NULL';
    lines.push(`
INSERT INTO parking_spots (
  id,
  spot_number,
  seat_number,
  location_id,
  spot_type_id,
  is_active,
  is_bci_managed,
  description
)
SELECT
  gen_random_uuid(),
  '${spot.spotCode}',
  '${spot.stallNumber}',
  1,
  (SELECT id FROM spot_types WHERE slug = '${spot.spotTypeSlug}' LIMIT 1),
  true,
  true,
  ${desc}
WHERE NOT EXISTS (SELECT 1 FROM parking_spots WHERE spot_number = '${spot.spotCode}');`);

    lines.push(`
UPDATE parking_spots SET
  seat_number = '${spot.stallNumber}',
  spot_type_id = (SELECT id FROM spot_types WHERE slug = '${spot.spotTypeSlug}' LIMIT 1),
  description = ${desc}
WHERE spot_number = '${spot.spotCode}';`);
  });
  lines.push('');
  
  lines.push('-- ============================================');
  lines.push('-- 5. SPOT ASSIGNMENTS (owner_id)');
  lines.push('-- ============================================');
  
  spots.filter(s => s.assignedUserEmail).forEach(spot => {
    lines.push(`
UPDATE parking_spots
SET owner_id = (SELECT id FROM users WHERE email = '${spot.assignedUserEmail}' LIMIT 1)
WHERE spot_number = '${spot.spotCode}'
  AND (SELECT id FROM users WHERE email = '${spot.assignedUserEmail}' LIMIT 1) IS NOT NULL;`);
  });
  lines.push('');
  
  lines.push('-- ============================================');
  lines.push('-- SUMMARY');
  lines.push('-- ============================================');
  lines.push(`-- Spot Types: 5`);
  lines.push(`-- Departments: ${departments.length}`);
  lines.push(`-- Users: ${users.length}`);
  lines.push(`-- Parking Spots: ${spots.length}`);
  lines.push(`-- Assigned Spots: ${spots.filter(s => s.assignedUserEmail).length}`);
  lines.push(`-- Unassigned Spots: ${spots.filter(s => !s.assignedUserEmail).length}`);
  lines.push('');
  lines.push('-- Verify the data:');
  lines.push('-- SELECT COUNT(*) FROM users;');
  lines.push('-- SELECT COUNT(*) FROM parking_spots;');
  lines.push('-- SELECT COUNT(*) FROM parking_spots WHERE owner_id IS NOT NULL;');
  
  return lines.join('\n');
}

async function main() {
  const data = await readExcelFile();
  const sql = generateSQL(data);
  
  const outputPath = path.join(process.cwd(), 'scripts/production-data.sql');
  fs.writeFileSync(outputPath, sql);
  
  const departments = [...new Set(
    data
      .map(r => normalizeDepartment(r['DEPARTMENT']))
      .filter(d => d && d !== 'General')
  )].sort();

  const usersMap = new Map<string, any>();
  data.forEach(row => {
    const name = row['FIRST NAME LAST NAME']?.toString().trim();
    if (name) {
      const email = generateEmail(name);
      usersMap.set(email, true);
    }
  });

  const spots = data.map(row => {
    const name = row['FIRST NAME LAST NAME']?.toString().trim();
    return {
      spotTypeSlug: getSpotTypeSlug(row['SPOT DESCRIPTION']),
      assignedUserEmail: name ? generateEmail(name) : null,
    };
  });

  console.log('='.repeat(60));
  console.log('Production Data Population Script Generated');
  console.log('='.repeat(60));
  console.log(`\nOutput file: ${outputPath}`);
  console.log(`\nStatistics:`);
  console.log(`  - Departments: ${departments.length}`);
  console.log(`  - Users: ${usersMap.size}`);
  console.log(`  - Parking Spots: ${spots.length}`);
  console.log(`  - Assigned Spots: ${spots.filter(s => s.assignedUserEmail).length}`);
  console.log(`  - Unassigned Spots: ${spots.filter(s => !s.assignedUserEmail).length}`);
  console.log(`\nSpot Types Breakdown:`);
  
  const typeBreakdown: Record<string, number> = {};
  spots.forEach(s => {
    typeBreakdown[s.spotTypeSlug] = (typeBreakdown[s.spotTypeSlug] || 0) + 1;
  });
  Object.entries(typeBreakdown).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });
  
  console.log(`\nTo run against production database:`);
  console.log(`  1. Review the generated SQL file: ${outputPath}`);
  console.log(`  2. Connect to your production database`);
  console.log(`  3. Execute the SQL script`);
  console.log(`\nAlternatively, set PRODUCTION_DATABASE_URL and run with --execute flag`);
  
  if (process.argv.includes('--execute') && process.env.PRODUCTION_DATABASE_URL) {
    console.log('\n' + '='.repeat(60));
    console.log('EXECUTING AGAINST PRODUCTION DATABASE');
    console.log('='.repeat(60));
    
    const dbClient = neon(process.env.PRODUCTION_DATABASE_URL);
    
    try {
      const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (stmt) {
          try {
            await dbClient(stmt);
            process.stdout.write('.');
          } catch (err: any) {
            console.error(`\nError executing statement ${i + 1}:`, err.message);
          }
        }
      }
      
      console.log('\n\nExecution complete!');
      
      const userCount = await dbClient('SELECT COUNT(*) FROM users');
      const spotCount = await dbClient('SELECT COUNT(*) FROM parking_spots');
      const assignedCount = await dbClient('SELECT COUNT(*) FROM parking_spots WHERE owner_id IS NOT NULL');
      
      console.log(`\nVerification:`);
      console.log(`  - Users in DB: ${userCount[0].count}`);
      console.log(`  - Spots in DB: ${spotCount[0].count}`);
      console.log(`  - Assigned Spots: ${assignedCount[0].count}`);
      
    } catch (err) {
      console.error('Database execution failed:', err);
      process.exit(1);
    }
  }
}

main().catch(console.error);
