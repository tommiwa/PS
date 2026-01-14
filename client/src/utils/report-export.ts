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
    const headerRow = dailySheet.addRow(['Date', 'Occupied Spots', 'Total Spots', 'Occupancy Rate']);
    headerRow.font = { bold: true };
    
    data.dailyOccupancy.forEach(day => {
      const occupancyRate = day.totalSpots > 0 ? (day.occupiedSpots / day.totalSpots) * 100 : 0;
      dailySheet.addRow([
        day.date,
        day.occupiedSpots,
        day.totalSpots,
        `${occupancyRate.toFixed(2)}%`
      ]);
    });
    
    dailySheet.getColumn(1).width = 15;
    dailySheet.getColumn(2).width = 18;
    dailySheet.getColumn(3).width = 15;
    dailySheet.getColumn(4).width = 18;
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
  
  const worksheet = workbook.addWorksheet('Spot Assignments');
  
  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'BCI ParkShare - Spot Assignment Report';
  titleCell.font = { bold: true, size: 16 };
  
  worksheet.mergeCells('A2:J2');
  const scopeLabel = data.scope === 'bci' ? 'BCI-Managed' : 'All';
  worksheet.getCell('A2').value = `Date Range: ${range.from} to ${range.to} | Scope: ${scopeLabel}`;
  
  worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleString()}`;
  
  worksheet.addRow([]);
  
  const headerRow = worksheet.addRow(['Action', 'User Name', 'Email', 'Department', 'Spot Number', 'Location', 'Spot Type', 'Monthly Fee', 'Effective Date', 'Assigned/Removed By']);
  headerRow.font = { bold: true };
  
  data.assignments.forEach(assignment => {
    worksheet.addRow([
      assignment.action === 'assigned' ? 'Assigned' : 'Unassigned',
      `${assignment.user.firstName} ${assignment.user.lastName}`,
      assignment.user.email,
      assignment.user.department,
      assignment.spot.spotNumber,
      assignment.spot.location,
      assignment.spot.spotType,
      `$${parseFloat(assignment.spot.monthlyFee ?? "0").toFixed(2)}`,
      new Date(assignment.effectiveAt).toLocaleDateString(),
      assignment.actor ? `${assignment.actor.firstName} ${assignment.actor.lastName}` : 'System'
    ]);
  });
  
  worksheet.getColumn(1).width = 12;
  worksheet.getColumn(2).width = 25;
  worksheet.getColumn(3).width = 30;
  worksheet.getColumn(4).width = 20;
  worksheet.getColumn(5).width = 12;
  worksheet.getColumn(6).width = 25;
  worksheet.getColumn(7).width = 15;
  worksheet.getColumn(8).width = 15;
  worksheet.getColumn(9).width = 15;
  worksheet.getColumn(10).width = 25;
  
  const buffer = await workbook.xlsx.writeBuffer();
  const scopeSuffix = data.scope === 'bci' ? '-bci' : '';
  saveAs(new Blob([buffer]), `spot-assignments-report${scopeSuffix}-${new Date().toISOString().split('T')[0]}.xlsx`);
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
  
  summarySheet.addRow([]);
  const reportSummaryRow = summarySheet.addRow(['REPORT SUMMARY']);
  reportSummaryRow.getCell(1).font = { bold: true, size: 14 };
  
  summarySheet.addRow(['Metric', 'Value']);
  summarySheet.addRow(['Total Bookings', data.summary.totalBookings]);
  summarySheet.addRow(['Total Amount Owed', `$${data.summary.totalAmount.toFixed(2)}`]);
  summarySheet.addRow(['Unique Users', data.summary.uniqueUsers]);
  
  summarySheet.addRow([]);
  const userSummaryRow = summarySheet.addRow(['USER SUMMARY - AMOUNTS OWED']);
  userSummaryRow.getCell(1).font = { bold: true, size: 14 };
  
  const userHeaderRow = summarySheet.addRow(['Name', 'Email', 'Department', 'Bookings', 'Total Amount Owed']);
  userHeaderRow.font = { bold: true };
  
  data.usageByUser.forEach(user => {
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
  detailSheet.mergeCells('A1:G1');
  const detailTitle = detailSheet.getCell('A1');
  detailTitle.value = 'Shared Pool Booking Details';
  detailTitle.font = { bold: true, size: 16 };
  
  detailSheet.addRow([]);
  const detailHeaderRow = detailSheet.addRow(['User Name', 'Email', 'Department', 'Spot Number', 'Location', 'Booking Date', 'Amount']);
  detailHeaderRow.font = { bold: true };
  
  data.usageByUser.forEach(user => {
    user.bookings.forEach(booking => {
      detailSheet.addRow([
        `${user.firstName} ${user.lastName}`,
        user.email,
        user.department,
        booking.spotNumber,
        booking.location,
        booking.bookingDate,
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
  
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `shared-pool-usage-report-${new Date().toISOString().split('T')[0]}.xlsx`);
}
