import ExcelJS from 'exceljs';
// @ts-ignore
import { saveAs } from 'file-saver';
import type {
  ReportOverviewResponse,
  ReportUtilizationResponse,
  ReportRevenueResponse,
  ReportUserComplianceResponse,
  ReportWaitlistPerformanceResponse,
  ReportDateRange,
  SpotAssignmentReportResponse,
  SharedPoolUsageReportResponse
} from '@shared/schema';

export interface ActiveUsersReportData {
  summary: {
    loginsToday: number;
    loginsInPeriod: number;
    uniqueListers: number;
    uniqueBookers: number;
    totalListings: number;
    totalBookings: number;
  };
  loggedInUsers: {
    userId: string;
    name: string;
    department: string;
    role: string;
    lastLogin: string | null;
  }[];
  listedSpotUsers: {
    userId: string;
    name: string;
    department: string;
    listingCount: number;
  }[];
  bookedSpotUsers: {
    userId: string;
    name: string;
    department: string;
    bookingCount: number;
    totalAmount: number;
  }[];
  dateRange: { from: string; to: string };
  generatedAt: string;
}

export async function exportActiveUsersReport(data: ActiveUsersReportData) {
  const workbook = new ExcelJS.Workbook();
  const { dateRange } = data;

  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - Active Users Report';
  titleCell.font = { bold: true, size: 16 };
  summarySheet.mergeCells('A2:B2');
  summarySheet.getCell('A2').value = `Date Range: ${dateRange.from} to ${dateRange.to}`;
  summarySheet.getCell('A3').value = `Generated: ${new Date().toLocaleString()}`;
  summarySheet.addRow([]);
  const summaryHeaderRow = summarySheet.addRow(['SUMMARY']);
  summaryHeaderRow.getCell(1).font = { bold: true };
  summarySheet.addRow(['Metric', 'Value']);
  summarySheet.addRow(['Logins Today', data.summary.loginsToday]);
  summarySheet.addRow(['Logins in Period', data.summary.loginsInPeriod]);
  summarySheet.addRow(['Unique Users Who Listed Spots', data.summary.uniqueListers]);
  summarySheet.addRow(['Unique Users Who Booked Spots', data.summary.uniqueBookers]);
  summarySheet.addRow(['Total Listings Created', data.summary.totalListings]);
  summarySheet.addRow(['Total Bookings Made', data.summary.totalBookings]);
  summarySheet.getColumn(1).width = 35;
  summarySheet.getColumn(2).width = 20;

  // Logged In sheet
  const loginSheet = workbook.addWorksheet('Logged In');
  const loginHeader = loginSheet.addRow(['Name', 'Department', 'Role', 'Last Login Date', 'Last Login Time']);
  loginHeader.font = { bold: true };
  data.loggedInUsers.forEach(u => {
    const dt = u.lastLogin ? new Date(u.lastLogin) : null;
    loginSheet.addRow([
      u.name,
      u.department,
      u.role,
      dt ? dt.toLocaleDateString() : '',
      dt ? dt.toLocaleTimeString() : ''
    ]);
  });
  loginSheet.getColumn(1).width = 30;
  loginSheet.getColumn(2).width = 20;
  loginSheet.getColumn(3).width = 12;
  loginSheet.getColumn(4).width = 18;
  loginSheet.getColumn(5).width = 18;

  // Listed Spots sheet
  const listSheet = workbook.addWorksheet('Listed Spots');
  const listHeader = listSheet.addRow(['Name', 'Department', 'Listings Created']);
  listHeader.font = { bold: true };
  data.listedSpotUsers.forEach(u => {
    listSheet.addRow([u.name, u.department, u.listingCount]);
  });
  listSheet.getColumn(1).width = 30;
  listSheet.getColumn(2).width = 20;
  listSheet.getColumn(3).width = 20;

  // Booked Spots sheet
  const bookSheet = workbook.addWorksheet('Booked Spots');
  const bookHeader = bookSheet.addRow(['Name', 'Department', 'Bookings Made', 'Total Amount']);
  bookHeader.font = { bold: true };
  data.bookedSpotUsers.forEach(u => {
    bookSheet.addRow([u.name, u.department, u.bookingCount, `$${u.totalAmount.toFixed(2)}`]);
  });
  bookSheet.getColumn(1).width = 30;
  bookSheet.getColumn(2).width = 20;
  bookSheet.getColumn(3).width = 18;
  bookSheet.getColumn(4).width = 18;

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `active-users-report-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportOverviewReport(data: ReportOverviewResponse, dateRange?: ReportDateRange) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Overview');
  
  const range = dateRange || data.dateRange;
  
  worksheet.mergeCells('A1:B1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - Overview Report';
  titleCell.font = { bold: true, size: 16 };
  
  worksheet.mergeCells('A2:B2');
  worksheet.getCell('A2').value = `Date Range: ${range.from} to ${range.to} | Scope: ${data.scope.toUpperCase()}`;
  
  worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleString()}`;
  
  worksheet.addRow([]);
  
  const summaryHeaderRow = worksheet.addRow(['SUMMARY METRICS']);
  summaryHeaderRow.getCell(1).font = { bold: true, size: 14 };
  
  worksheet.addRow(['Metric', 'Value']);
  worksheet.addRow(['Total Spots', data.summary.totalSpots]);
  worksheet.addRow(['Active Bookings', data.summary.activeBookings]);
  worksheet.addRow(['Total Revenue', `$${data.summary.totalRevenue.toFixed(2)}`]);
  worksheet.addRow(['Active Users', data.summary.activeUsers]);
  worksheet.addRow(['Waitlist Count', data.summary.waitlistCount]);
  worksheet.addRow(['Utilization Rate', `${data.summary.utilizationRate.toFixed(2)}%`]);
  
  worksheet.addRow([]);
  
  const quickStatsRow = worksheet.addRow(['QUICK STATS']);
  quickStatsRow.getCell(1).font = { bold: true, size: 14 };
  
  worksheet.addRow(['Metric', 'Value']);
  worksheet.addRow(['Today Bookings', data.quickStats.todayBookings]);
  worksheet.addRow(['This Week Revenue', `$${data.quickStats.thisWeekRevenue.toFixed(2)}`]);
  worksheet.addRow(['Pending Payments', data.quickStats.pendingPayments]);
  worksheet.addRow(['Active Disputes', data.quickStats.activeDisputes]);
  
  worksheet.getColumn(1).width = 25;
  worksheet.getColumn(2).width = 20;
  
  const buffer = await workbook.xlsx.writeBuffer();
  const scopeSuffix = data.scope === 'bci' ? '-bci' : '';
  saveAs(new Blob([buffer]), `overview-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportUtilizationReport(data: ReportUtilizationResponse, dateRange?: ReportDateRange) {
  const workbook = new ExcelJS.Workbook();
  const range = dateRange || data.dateRange;
  
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.mergeCells('A1:D1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - Utilization Report';
  titleCell.font = { bold: true, size: 16 };
  
  summarySheet.addRow([]);
  const spotUsageRow = summarySheet.addRow(['SPOT USAGE']);
  spotUsageRow.getCell(1).font = { bold: true };
  
  summarySheet.addRow(['Total Spots', data.spotUsage.totalSpots]);
  summarySheet.addRow(['Allocated Spots', data.spotUsage.allocatedSpots]);
  summarySheet.addRow(['Unallocated Spots', data.spotUsage.unallocatedSpots]);
  summarySheet.addRow(['Bookable Spots', data.spotUsage.bookableSpots]);
  summarySheet.addRow(['Utilization Rate', `${data.spotUsage.utilizationRate.toFixed(2)}%`]);
  
  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 20;
  
  if (data.locationBreakdown.length > 0) {
    const locSheet = workbook.addWorksheet('Locations');
    const headerRow = locSheet.addRow(['Location', 'Total Spots', 'Occupied Spots', 'Occupancy Rate', 'Revenue']);
    headerRow.font = { bold: true };
    
    data.locationBreakdown.forEach(loc => {
      locSheet.addRow([
        loc.location,
        loc.totalSpots,
        loc.occupiedSpots,
        `${loc.occupancyRate.toFixed(2)}%`,
        `$${loc.revenue.toFixed(2)}`
      ]);
    });
    
    locSheet.getColumn(1).width = 40;
    locSheet.getColumn(2).width = 15;
    locSheet.getColumn(3).width = 18;
    locSheet.getColumn(4).width = 18;
    locSheet.getColumn(5).width = 15;
  }
  
  if (data.spotTypeBreakdown.length > 0) {
    const typeSheet = workbook.addWorksheet('Spot Types');
    const headerRow = typeSheet.addRow(['Type', 'Count', 'Booked Count', 'Utilization Rate']);
    headerRow.font = { bold: true };
    
    data.spotTypeBreakdown.forEach(type => {
      typeSheet.addRow([
        type.type,
        type.count,
        type.bookedCount,
        `${type.utilizationRate.toFixed(2)}%`
      ]);
    });
    
    typeSheet.getColumn(1).width = 25;
    typeSheet.getColumn(2).width = 15;
    typeSheet.getColumn(3).width = 18;
    typeSheet.getColumn(4).width = 20;
  }
  
  if (data.dailyOccupancy.length > 0) {
    const dailySheet = workbook.addWorksheet('Daily Occupancy');
    const headerRow = dailySheet.addRow(['Date', 'Occupied Spots', 'Total Spots', 'Occupancy Rate', 'BCI Bookings', 'P2P Bookings']);
    headerRow.font = { bold: true };
    
    data.dailyOccupancy.forEach(day => {
      const occupancyRate = day.totalSpots > 0 ? (day.occupiedSpots / day.totalSpots) * 100 : 0;
      dailySheet.addRow([
        day.date,
        day.occupiedSpots,
        day.totalSpots,
        `${occupancyRate.toFixed(2)}%`,
        day.bciBookings ?? 0,
        day.p2pBookings ?? 0
      ]);
    });
    
    dailySheet.getColumn(1).width = 15;
    dailySheet.getColumn(2).width = 18;
    dailySheet.getColumn(3).width = 15;
    dailySheet.getColumn(4).width = 18;
    dailySheet.getColumn(5).width = 18;
    dailySheet.getColumn(6).width = 18;
  }
  
  const buffer = await workbook.xlsx.writeBuffer();
  const scopeSuffix = data.scope === 'bci' ? '-bci' : '';
  saveAs(new Blob([buffer]), `utilization-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportRevenueReport(data: ReportRevenueResponse, dateRange?: ReportDateRange) {
  const workbook = new ExcelJS.Workbook();
  const range = dateRange || data.dateRange;
  
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - Revenue Report';
  titleCell.font = { bold: true, size: 16 };
  
  summarySheet.mergeCells('A2:B2');
  summarySheet.getCell('A2').value = `Date Range: ${range.from} to ${range.to} | Scope: ${data.scope.toUpperCase()}`;
  
  summarySheet.getCell('A3').value = `Generated: ${new Date().toLocaleString()}`;
  
  summarySheet.addRow([]);
  const revSummaryRow = summarySheet.addRow(['REVENUE SUMMARY']);
  revSummaryRow.getCell(1).font = { bold: true };
  
  summarySheet.addRow(['Metric', 'Value']);
  summarySheet.addRow(['Total Revenue', `$${data.summary.totalRevenue.toFixed(2)}`]);
  summarySheet.addRow(['Owner Earnings (85%)', `$${data.summary.ownerEarnings.toFixed(2)}`]);
  summarySheet.addRow(['BCI Revenue (15%)', `$${data.summary.bciRevenue.toFixed(2)}`]);
  summarySheet.addRow(['Average Booking Value', `$${data.summary.averageBookingValue.toFixed(2)}`]);
  summarySheet.addRow(['Total Bookings', data.summary.totalBookings]);
  
  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 20;
  
  if (data.monthlyTrends.length > 0) {
    const trendsSheet = workbook.addWorksheet('Monthly Trends');
    const headerRow = trendsSheet.addRow(['Month', 'Revenue', 'Bookings', 'Average Value']);
    headerRow.font = { bold: true };
    
    data.monthlyTrends.forEach(month => {
      trendsSheet.addRow([
        month.month,
        `$${month.revenue.toFixed(2)}`,
        month.bookings,
        `$${month.averageValue.toFixed(2)}`
      ]);
    });
    
    trendsSheet.getColumn(1).width = 15;
    trendsSheet.getColumn(2).width = 15;
    trendsSheet.getColumn(3).width = 15;
    trendsSheet.getColumn(4).width = 18;
  }
  
  if (data.revenueByLocation.length > 0) {
    const locSheet = workbook.addWorksheet('Revenue by Location');
    const headerRow = locSheet.addRow(['Location', 'Revenue', 'Bookings', 'Average Rate']);
    headerRow.font = { bold: true };
    
    data.revenueByLocation.forEach(loc => {
      locSheet.addRow([
        loc.location,
        `$${loc.revenue.toFixed(2)}`,
        loc.bookings,
        `$${loc.averageRate.toFixed(2)}`
      ]);
    });
    
    locSheet.getColumn(1).width = 40;
    locSheet.getColumn(2).width = 15;
    locSheet.getColumn(3).width = 15;
    locSheet.getColumn(4).width = 18;
  }
  
  if (data.revenueBySpotType.length > 0) {
    const typeSheet = workbook.addWorksheet('Revenue by Type');
    const headerRow = typeSheet.addRow(['Spot Type', 'Revenue', 'Bookings']);
    headerRow.font = { bold: true };
    
    data.revenueBySpotType.forEach(type => {
      typeSheet.addRow([
        type.type,
        `$${type.revenue.toFixed(2)}`,
        type.bookings
      ]);
    });
    
    typeSheet.getColumn(1).width = 25;
    typeSheet.getColumn(2).width = 15;
    typeSheet.getColumn(3).width = 15;
  }
  
  if (data.topEarners.length > 0) {
    const earnersSheet = workbook.addWorksheet('Top Earners');
    const headerRow = earnersSheet.addRow(['Owner Name', 'Total Earnings', 'Bookings Count']);
    headerRow.font = { bold: true };
    
    data.topEarners.forEach(earner => {
      earnersSheet.addRow([
        earner.ownerName,
        `$${earner.totalEarnings.toFixed(2)}`,
        earner.bookingsCount
      ]);
    });
    
    earnersSheet.getColumn(1).width = 30;
    earnersSheet.getColumn(2).width = 18;
    earnersSheet.getColumn(3).width = 18;
  }
  
  const buffer = await workbook.xlsx.writeBuffer();
  const scopeSuffix = data.scope === 'bci' ? '-bci' : '';
  saveAs(new Blob([buffer]), `revenue-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportUserComplianceReport(data: ReportUserComplianceResponse, dateRange?: ReportDateRange) {
  const workbook = new ExcelJS.Workbook();
  const range = dateRange || data.dateRange;
  
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - User & Compliance Report';
  titleCell.font = { bold: true, size: 16 };
  
  summarySheet.mergeCells('A2:B2');
  summarySheet.getCell('A2').value = `Date Range: ${range.from} to ${range.to} | Scope: ${data.scope.toUpperCase()}`;
  
  summarySheet.getCell('A3').value = `Generated: ${new Date().toLocaleString()}`;
  
  summarySheet.addRow([]);
  const userActivityRow = summarySheet.addRow(['USER ACTIVITY']);
  userActivityRow.getCell(1).font = { bold: true };
  
  summarySheet.addRow(['Metric', 'Value']);
  summarySheet.addRow(['Total Users', data.userActivity.totalUsers]);
  summarySheet.addRow(['Active Users', data.userActivity.activeUsers]);
  summarySheet.addRow(['New Registrations', data.userActivity.newRegistrations]);
  summarySheet.addRow(['Suspended Users', data.userActivity.suspendedUsers]);
  summarySheet.addRow(['Deleted Users', data.userActivity.deletedUsers]);
  
  summarySheet.addRow([]);
  const termsRow = summarySheet.addRow(['TERMS COMPLIANCE']);
  termsRow.getCell(1).font = { bold: true };
  
  summarySheet.addRow(['Metric', 'Value']);
  summarySheet.addRow(['Accepted Latest Terms', data.termsCompliance.acceptedLatestTerms]);
  summarySheet.addRow(['Pending Acceptance', data.termsCompliance.pendingAcceptance]);
  summarySheet.addRow(['Compliance Rate', `${data.termsCompliance.complianceRate.toFixed(2)}%`]);
  
  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 20;
  
  if (data.roleDistribution.length > 0) {
    const rolesSheet = workbook.addWorksheet('Role Distribution');
    const headerRow = rolesSheet.addRow(['Role', 'Count', 'Percentage']);
    headerRow.font = { bold: true };
    
    data.roleDistribution.forEach(role => {
      rolesSheet.addRow([
        role.role,
        role.count,
        `${role.percentage.toFixed(2)}%`
      ]);
    });
    
    rolesSheet.getColumn(1).width = 20;
    rolesSheet.getColumn(2).width = 15;
    rolesSheet.getColumn(3).width = 15;
  }
  
  if (data.departmentBreakdown.length > 0) {
    const deptSheet = workbook.addWorksheet('Departments');
    const headerRow = deptSheet.addRow(['Department', 'User Count', 'Active Users', 'Spots Owned', 'Bookings Made']);
    headerRow.font = { bold: true };
    
    data.departmentBreakdown.forEach(dept => {
      deptSheet.addRow([
        dept.department,
        dept.userCount,
        dept.activeUsers,
        dept.spotsOwned,
        dept.bookingsMade
      ]);
    });
    
    deptSheet.getColumn(1).width = 25;
    deptSheet.getColumn(2).width = 15;
    deptSheet.getColumn(3).width = 15;
    deptSheet.getColumn(4).width = 15;
    deptSheet.getColumn(5).width = 18;
  }
  
  const buffer = await workbook.xlsx.writeBuffer();
  const scopeSuffix = data.scope === 'bci' ? '-bci' : '';
  saveAs(new Blob([buffer]), `user-compliance-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportWaitlistPerformanceReport(data: ReportWaitlistPerformanceResponse, dateRange?: ReportDateRange) {
  const workbook = new ExcelJS.Workbook();
  const range = dateRange || data.dateRange;
  
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - Waitlist Performance Report';
  titleCell.font = { bold: true, size: 16 };
  
  summarySheet.mergeCells('A2:B2');
  summarySheet.getCell('A2').value = `Date Range: ${range.from} to ${range.to} | Scope: ${data.scope.toUpperCase()}`;
  
  summarySheet.getCell('A3').value = `Generated: ${new Date().toLocaleString()}`;
  
  summarySheet.addRow([]);
  const waitlistRow = summarySheet.addRow(['WAITLIST SUMMARY']);
  waitlistRow.getCell(1).font = { bold: true };
  
  summarySheet.addRow(['Metric', 'Value']);
  summarySheet.addRow(['Total Requests', data.summary.totalRequests]);
  summarySheet.addRow(['Active Requests', data.summary.activeRequests]);
  summarySheet.addRow(['Assigned Requests', data.summary.assignedRequests]);
  summarySheet.addRow(['Cancelled Requests', data.summary.cancelledRequests]);
  summarySheet.addRow(['Average Wait Time (days)', data.summary.averageWaitTime]);
  summarySheet.addRow(['Fulfillment Rate', `${data.summary.fulfillmentRate.toFixed(2)}%`]);
  
  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 20;
  
  if (data.priorityBreakdown.length > 0) {
    const prioritySheet = workbook.addWorksheet('Priority Breakdown');
    const headerRow = prioritySheet.addRow(['Priority', 'Count', 'Avg Wait Days', 'Fulfillment Rate']);
    headerRow.font = { bold: true };
    
    data.priorityBreakdown.forEach(priority => {
      prioritySheet.addRow([
        priority.priorityLabel,
        priority.count,
        priority.averageWaitDays,
        `${priority.fulfillmentRate.toFixed(2)}%`
      ]);
    });
    
    prioritySheet.getColumn(1).width = 15;
    prioritySheet.getColumn(2).width = 15;
    prioritySheet.getColumn(3).width = 18;
    prioritySheet.getColumn(4).width = 20;
  }
  
  if (data.spotTypePreferences.length > 0) {
    const typeSheet = workbook.addWorksheet('Spot Preferences');
    const headerRow = typeSheet.addRow(['Spot Type', 'Request Count', 'Fulfilled Count', 'Fulfillment Rate']);
    headerRow.font = { bold: true };
    
    data.spotTypePreferences.forEach(type => {
      typeSheet.addRow([
        type.spotType,
        type.requestCount,
        type.fulfilledCount,
        `${type.fulfillmentRate.toFixed(2)}%`
      ]);
    });
    
    typeSheet.getColumn(1).width = 25;
    typeSheet.getColumn(2).width = 18;
    typeSheet.getColumn(3).width = 18;
    typeSheet.getColumn(4).width = 20;
  }
  
  if (data.departmentRequests.length > 0) {
    const deptSheet = workbook.addWorksheet('Department Requests');
    const headerRow = deptSheet.addRow(['Department', 'Active Requests', 'Assigned Requests', 'Avg Wait Days']);
    headerRow.font = { bold: true };
    
    data.departmentRequests.forEach(dept => {
      deptSheet.addRow([
        dept.department,
        dept.activeRequests,
        dept.assignedRequests,
        dept.averageWaitDays
      ]);
    });
    
    deptSheet.getColumn(1).width = 25;
    deptSheet.getColumn(2).width = 18;
    deptSheet.getColumn(3).width = 20;
    deptSheet.getColumn(4).width = 18;
  }
  
  const buffer = await workbook.xlsx.writeBuffer();
  const scopeSuffix = data.scope === 'bci' ? '-bci' : '';
  saveAs(new Blob([buffer]), `waitlist-performance-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportSpotAssignmentsReport(data: SpotAssignmentReportResponse, dateRange?: ReportDateRange) {
  const workbook = new ExcelJS.Workbook();
  const range = dateRange || data.dateRange;
  
  // Calculate stats
  const optInCount = data.assignments.filter(a => a.action === 'assigned').length;
  const optOutCount = data.assignments.filter(a => a.action === 'unassigned').length;
  
  const worksheet = workbook.addWorksheet('Spot Assignment Changes');
  
  worksheet.mergeCells('A1:K1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - Spot Assignment Changes Report';
  titleCell.font = { bold: true, size: 16 };
  
  worksheet.mergeCells('A2:K2');
  const scopeLabel = data.scope === 'bci' ? 'BCI-Managed' : 'All';
  worksheet.getCell('A2').value = `Date Range: ${range.from} to ${range.to} | Scope: ${scopeLabel}`;
  
  worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleString()}`;
  
  // Add summary stats
  worksheet.addRow([]);
  const summaryRow = worksheet.addRow(['Summary:', `Total Changes: ${data.assignments.length}`, `Opt-In: ${optInCount}`, `Opt-Out: ${optOutCount}`]);
  summaryRow.getCell(1).font = { bold: true };
  
  worksheet.addRow([]);
  
  const headerRow = worksheet.addRow(['Action', 'Fee Change', 'Employee Name', 'Email', 'Department', 'Spot Number', 'Location', 'Spot Type', 'Monthly Fee', 'Effective Date', 'Changed By']);
  headerRow.font = { bold: true };
  
  data.assignments.forEach(assignment => {
    const monthlyFee = parseFloat(assignment.spot.monthlyFee ?? "0");
    worksheet.addRow([
      assignment.action === 'assigned' ? 'Opt-In (Assigned)' : 'Opt-Out (Unassigned)',
      assignment.action === 'assigned' ? `+$${monthlyFee.toFixed(2)}` : `-$${monthlyFee.toFixed(2)}`,
      `${assignment.user.firstName} ${assignment.user.lastName}`,
      assignment.user.email,
      assignment.user.department,
      assignment.spot.spotNumber,
      assignment.spot.location,
      assignment.spot.spotType,
      `$${monthlyFee.toFixed(2)}`,
      new Date(assignment.effectiveAt).toLocaleDateString(),
      assignment.actor ? `${assignment.actor.firstName} ${assignment.actor.lastName}` : 'System'
    ]);
  });
  
  worksheet.getColumn(1).width = 20;
  worksheet.getColumn(2).width = 12;
  worksheet.getColumn(3).width = 25;
  worksheet.getColumn(4).width = 30;
  worksheet.getColumn(5).width = 20;
  worksheet.getColumn(6).width = 12;
  worksheet.getColumn(7).width = 25;
  worksheet.getColumn(8).width = 15;
  worksheet.getColumn(9).width = 15;
  worksheet.getColumn(10).width = 15;
  worksheet.getColumn(11).width = 25;
  
  const buffer = await workbook.xlsx.writeBuffer();
  const scopeSuffix = data.scope === 'bci' ? '-bci' : '';
  saveAs(new Blob([buffer]), `spot-assignment-changes${scopeSuffix}-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportSharedPoolUsageReport(data: SharedPoolUsageReportResponse, dateRange?: { from: string; to: string }) {
  const workbook = new ExcelJS.Workbook();
  const range = dateRange || data.dateRange;
  
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.mergeCells('A1:E1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - Shared Pool Usage Report';
  titleCell.font = { bold: true, size: 16 };
  
  summarySheet.mergeCells('A2:E2');
  summarySheet.getCell('A2').value = `Date Range: ${range.from} to ${range.to}`;
  
  summarySheet.mergeCells('A3:E3');
  summarySheet.getCell('A3').value = `For Salary Deduction Processing`;
  summarySheet.getCell('A3').font = { italic: true };
  
  summarySheet.getCell('A4').value = `Generated: ${new Date().toLocaleString()}`;
  
  // Filter out removed bookings for export
  const filteredData = data.usageByUser.map(user => {
    const activeBookings = user.bookings.filter(b => !b.excludedFromPayroll);
    return {
      ...user,
      bookings: activeBookings,
      bookingCount: activeBookings.length,
      totalAmount: activeBookings.reduce((sum, b) => sum + b.amount, 0)
    };
  }).filter(user => user.bookingCount > 0);
  
  const totalActiveBookings = filteredData.reduce((sum, u) => sum + u.bookingCount, 0);
  const totalActiveAmount = filteredData.reduce((sum, u) => sum + u.totalAmount, 0);
  
  summarySheet.addRow([]);
  const reportSummaryRow = summarySheet.addRow(['REPORT SUMMARY']);
  reportSummaryRow.getCell(1).font = { bold: true, size: 14 };
  
  summarySheet.addRow(['Metric', 'Value']);
  summarySheet.addRow(['Total Bookings', totalActiveBookings]);
  summarySheet.addRow(['Total Amount Owed', `$${totalActiveAmount.toFixed(2)}`]);
  summarySheet.addRow(['Unique Users', filteredData.length]);
  
  summarySheet.addRow([]);
  const userSummaryRow = summarySheet.addRow(['USER SUMMARY - AMOUNTS OWED']);
  userSummaryRow.getCell(1).font = { bold: true, size: 14 };
  
  const userHeaderRow = summarySheet.addRow(['Name', 'Email', 'Department', 'Bookings', 'Total Amount Owed']);
  userHeaderRow.font = { bold: true };
  
  filteredData.forEach(user => {
    summarySheet.addRow([
      `${user.firstName} ${user.lastName}`,
      user.email,
      user.department,
      user.bookingCount,
      `$${user.totalAmount.toFixed(2)}`
    ]);
  });
  
  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 35;
  summarySheet.getColumn(3).width = 20;
  summarySheet.getColumn(4).width = 12;
  summarySheet.getColumn(5).width = 18;
  
  const detailSheet = workbook.addWorksheet('Booking Details');
  detailSheet.mergeCells('A1:H1');
  const detailTitle = detailSheet.getCell('A1');
  detailTitle.value = 'Shared Pool Booking Details';
  detailTitle.font = { bold: true, size: 16 };
  
  detailSheet.addRow([]);
  const detailHeaderRow = detailSheet.addRow(['User Name', 'Email', 'Department', 'Spot Number', 'Location', 'Usage Date', 'Type', 'Amount']);
  detailHeaderRow.font = { bold: true };
  
  // Use filtered data (excludes removed bookings)
  filteredData.forEach(user => {
    user.bookings.forEach(booking => {
      detailSheet.addRow([
        `${user.firstName} ${user.lastName}`,
        user.email,
        user.department,
        booking.spotNumber,
        booking.location,
        booking.bookingDate,
        booking.donateToCharity ? 'Charity' : 'Regular',
        `$${booking.amount.toFixed(2)}`
      ]);
    });
  });
  
  detailSheet.getColumn(1).width = 30;
  detailSheet.getColumn(2).width = 35;
  detailSheet.getColumn(3).width = 20;
  detailSheet.getColumn(4).width = 15;
  detailSheet.getColumn(5).width = 35;
  detailSheet.getColumn(6).width = 15;
  detailSheet.getColumn(7).width = 12;
  detailSheet.getColumn(8).width = 12;
  
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `shared-pool-usage-report-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Interface for Payroll Period Summary
interface PayrollBookingExport {
  id: string;
  spotNumber: string;
  spotLocation: string;
  renterName: string;
  renterEmail: string;
  renterDepartment: string;
  bookingDate: string;
  totalAmount: number;
  status: string;
  excludedFromPayroll: boolean;
  donateToCharity: boolean;
}

interface PayrollPeriodSummaryExport {
  period: string;
  periodLabel: string;
  totalBookings: number;
  totalAmount: number;
  bookings: PayrollBookingExport[];
}

export async function exportPayrollSummaryReport(periods: PayrollPeriodSummaryExport[]) {
  const workbook = new ExcelJS.Workbook();
  
  periods.forEach(period => {
    const worksheet = workbook.addWorksheet(period.periodLabel.substring(0, 31));
    
    worksheet.mergeCells('A1:I1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `BCI ParkShare - Payroll Deduction Summary - ${period.periodLabel}`;
    titleCell.font = { bold: true, size: 16 };
    
    worksheet.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
    
    worksheet.addRow([]);
    const summaryRow = worksheet.addRow(['PERIOD SUMMARY']);
    summaryRow.getCell(1).font = { bold: true, size: 14 };
    
    // Calculate active bookings (not removed)
    const activeBookings = period.bookings.filter(b => !b.excludedFromPayroll);
    const removedBookings = period.bookings.filter(b => b.excludedFromPayroll);
    const activeAmount = activeBookings.reduce((sum, b) => sum + b.totalAmount, 0);
    
    worksheet.addRow(['Metric', 'Value']);
    worksheet.addRow(['Total Bookings (Active)', activeBookings.length]);
    worksheet.addRow(['Total Amount (Active)', `$${activeAmount.toFixed(2)}`]);
    worksheet.addRow(['Removed Bookings', removedBookings.length]);
    
    worksheet.addRow([]);
    const detailRow = worksheet.addRow(['BOOKING DETAILS']);
    detailRow.getCell(1).font = { bold: true, size: 14 };
    
    const headerRow = worksheet.addRow(['Employee', 'Email', 'Department', 'Spot', 'Location', 'Usage Date', 'Type', 'Amount', 'Status']);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' }
      };
    });
    
    period.bookings.forEach(booking => {
      const row = worksheet.addRow([
        booking.renterName,
        booking.renterEmail,
        booking.renterDepartment || '-',
        booking.spotNumber,
        booking.spotLocation,
        booking.bookingDate,
        booking.donateToCharity ? 'Charity' : 'Regular',
        `$${booking.totalAmount.toFixed(2)}`,
        booking.excludedFromPayroll ? 'REMOVED' : (booking.status === 'completed' ? 'Completed' : 'Upcoming')
      ]);
      
      // Style removed rows with red background and text
      if (booking.excludedFromPayroll) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEE2E2' } // Light red background
          };
          cell.font = { color: { argb: 'FFDC2626' } }; // Red text
        });
      }
      
      // Style charity rows with pink type cell
      if (booking.donateToCharity) {
        const typeCell = row.getCell(7);
        typeCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE7F3' } // Light pink
        };
        typeCell.font = { color: { argb: 'FFBE185D' } }; // Pink text
      }
    });
    
    worksheet.getColumn(1).width = 25;
    worksheet.getColumn(2).width = 30;
    worksheet.getColumn(3).width = 20;
    worksheet.getColumn(4).width = 10;
    worksheet.getColumn(5).width = 35;
    worksheet.getColumn(6).width = 15;
    worksheet.getColumn(7).width = 12;
    worksheet.getColumn(8).width = 12;
    worksheet.getColumn(9).width = 12;
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `payroll-deduction-summary-${new Date().toISOString().split('T')[0]}.xlsx`);
}
