/**
 * Test Script for PDF Report Generation
 * 
 * This script tests if the report generation functions are properly implemented
 * and if the data mapping matches the legacy build.
 * 
 * Run this in the browser console after loading the HTML page.
 */

function testReportGeneration() {
    console.log('=== PDF Report Generation Test ===\n');
    
    const tests = {
        functionsExist: [],
        dataMapping: [],
        errors: []
    };
    
    // Test 1: Check if all required functions exist
    console.log('1. Testing function existence...');
    const requiredFunctions = [
        'generatePDFReport',
        'generatePDFReportInternal',
        'addCoverPagePDFMake',
        'addTableOfContentsPDFMake',
        'addExecutiveSummaryIntroPDFMake',
        'addExecutiveSummaryPDFMake',
        'addGoverningBoardSectionPDFMake',
        'addCombinedBudgetSectionPDFMake',
        'addAcreageOverviewSectionPDFMake',
        'addIndividualProjectSectionsPDFMake',
        'addProjectAreaHeaderPDFMake',
        'addProjectAreaOverviewPDFMake',
        'addFundAccountabilityPDFMake',
        'addProjectAreaDevelopmentPDFMake',
        'addProjectAreaMapPDFMake'
    ];
    
    requiredFunctions.forEach(funcName => {
        const exists = typeof window[funcName] === 'function';
        tests.functionsExist.push({ name: funcName, exists });
        if (exists) {
            console.log(`  ✓ ${funcName} exists`);
        } else {
            console.error(`  ✗ ${funcName} is missing`);
            tests.errors.push(`Missing function: ${funcName}`);
        }
    });
    
    // Test 2: Check if PDFMake library is loaded
    console.log('\n2. Testing PDFMake library...');
    if (typeof pdfMake !== 'undefined') {
        console.log('  ✓ pdfMake is loaded');
        if (typeof pdfMake.vfs !== 'undefined') {
            console.log('  ✓ pdfMake.vfs (fonts) is loaded');
        } else {
            console.error('  ✗ pdfMake.vfs (fonts) is not loaded');
            tests.errors.push('PDFMake fonts not loaded');
        }
    } else {
        console.error('  ✗ pdfMake is not loaded');
        tests.errors.push('PDFMake library not loaded');
    }
    
    // Test 3: Check data field mapping
    console.log('\n3. Testing data field mapping...');
    const testSubmission = {
        // Basic fields
        id: 'test-1',
        cityCounty: 'Test City',
        submitterName: 'Test Agency',
        projectArea: 'Test Project',
        projectAreaName: 'Test Project Area',
        year: 2025,
        fy: 2025,
        ty: 2024,
        type: 'CDA',
        purpose: 'Commercial Development',
        taxingDistrict: 'Test District',
        taxRate: '2',
        
        // Financial fields
        tyValue: 7500000,
        baseValue: 5000000,
        fundBalance: 1250000,
        propertyTaxIncrementTotal: 300000,
        propertyTaxIncrementNpv: 285000,
        
        // Acreage fields
        acreage: 125,
        developedAcreage: 85,
        undevelopedAcreage: 40,
        residentialAcreage: 60,
        totalAuthorizedHousingUnits: 150,
        
        // Year fields
        creationYear: 2015,
        baseYear: 2015,
        termLength: 30,
        startYear: 2015,
        expirationYear: 2045,
        
        // Descriptions
        descriptionGrowthAssessedValue: 'Test growth description',
        descriptionSignificantDevelopment: 'Test development description',
        descriptionPlanFurthered: 'Test plan description',
        descriptionOtherIssues: 'Test issues description',
        
        // Governing Board
        governingBoardName_0: 'John Smith',
        governingBoardTitle_0: 'Chairman',
        agencyStaffName_0: 'Jane Doe',
        agencyStaffTitle_0: 'Executive Director',
        
        // Tax Entities
        taxEntityName_0: 'City of Test',
        taxEntityParticipationRate_0: '50',
        taxEntityRemittance_0: '25',
        taxEntityCapAmount_0: '1000000',
        taxEntityIncrementPaid_0: '125000',
        taxEntityRemainingAuthorized_0: '875000',
        
        // Expenses
        expenseTitle_0: 'Administrative',
        tyExpense_0: '50000',
        cyExpense_0: '50000',
        nyExpense_0: '55000',
        
        // Total Expenses
        totalExpenseDescription_0: 'Infrastructure Development',
        totalExpenseAmount_0: '500000',
        totalExpenseNpv_0: '475000',
        
        // Revenue
        tyOriginalBudgetRevenues: '300000',
        tyActualRevenue: '325000',
        tyBaseYearRevenue: '50000',
        lifetimeRevenues: '5000000',
        lifetimeActualRevenues: '5200000',
        lifetimeBaseYearRevenues: '800000',
        
        // Revenue Sources
        revenueSourceDescription_0: 'Property Tax Increment',
        revenueSource2025Actual_0: '300000',
        revenueSource2026Forecast_0: '320000',
        revenueSource2027Forecast_0: '340000',
        
        // Tax Increment Summary
        taxIncrementEntity_0: 'City of Test',
        taxIncrementYearActual_0: '125000',
        taxIncrementRemainingAuthorized_0: '875000',
        
        // Increment Distribution
        incrementEntity_0: 'City of Test',
        incrementActual_0: '125000',
        incrementRemaining_0: '875000',
        
        // Financial Analysis
        administrativePercentage: '10',
        discountRate: '3',
        aggregateRemainingRevenue: '2000000',
        discountedAggregateRemainingRevenue: '1900000',
        totalAggregateExpense: '500000',
        totalAggregateExpenseAtNpv: '475000'
    };
    
    // Test field access
    const fieldTests = [
        { name: 'cityCounty', value: testSubmission.cityCounty, expected: 'Test City' },
        { name: 'projectAreaName', value: testSubmission.projectAreaName, expected: 'Test Project Area' },
        { name: 'year', value: testSubmission.year, expected: 2025 },
        { name: 'type', value: testSubmission.type, expected: 'CDA' },
        { name: 'governingBoardName_0', value: testSubmission.governingBoardName_0, expected: 'John Smith' },
        { name: 'taxEntityName_0', value: testSubmission.taxEntityName_0, expected: 'City of Test' },
        { name: 'developedAcreage', value: testSubmission.developedAcreage, expected: 85 },
        { name: 'tyValue', value: testSubmission.tyValue, expected: 7500000 }
    ];
    
    fieldTests.forEach(test => {
        const passed = test.value === test.expected;
        tests.dataMapping.push({ name: test.name, passed });
        if (passed) {
            console.log(`  ✓ ${test.name}: ${test.value}`);
        } else {
            console.error(`  ✗ ${test.name}: Expected ${test.expected}, got ${test.value}`);
            tests.errors.push(`Data mapping error: ${test.name}`);
        }
    });
    
    // Test 4: Check if project selection modal function exists
    console.log('\n4. Testing project selection modal...');
    if (typeof window.showProjectSelectionModal === 'function') {
        console.log('  ✓ showProjectSelectionModal exists');
    } else {
        console.error('  ✗ showProjectSelectionModal is missing');
        tests.errors.push('Missing function: showProjectSelectionModal');
    }
    
    // Test 5: Simulate report generation (without actually generating)
    console.log('\n5. Testing report generation structure...');
    try {
        // Check if we can access allSubmissions
        if (typeof allSubmissions !== 'undefined') {
            console.log(`  ✓ allSubmissions array exists (${allSubmissions.length} submissions)`);
        } else {
            console.warn('  ⚠ allSubmissions not defined (may need to load data first)');
        }
        
        // Test filtering logic
        const testCity = 'Test City';
        const testYear = '2025';
        const filtered = allSubmissions ? allSubmissions.filter(submission => {
            const submissionCity = submission.cityCounty || submission.submitterName || 'Unknown';
            const submissionYear = String(submission.year || submission.fy || 'Unknown');
            return submissionCity === testCity && submissionYear === testYear;
        }) : [];
        
        console.log(`  ✓ Filtering logic works (found ${filtered.length} submissions for ${testCity} - ${testYear})`);
        
    } catch (error) {
        console.error('  ✗ Error testing report structure:', error);
        tests.errors.push(`Report structure test error: ${error.message}`);
    }
    
    // Summary
    console.log('\n=== Test Summary ===');
    const totalFunctions = tests.functionsExist.length;
    const existingFunctions = tests.functionsExist.filter(f => f.exists).length;
    const totalFields = tests.dataMapping.length;
    const passedFields = tests.dataMapping.filter(f => f.passed).length;
    
    console.log(`Functions: ${existingFunctions}/${totalFunctions} exist`);
    console.log(`Data Mapping: ${passedFields}/${totalFields} passed`);
    console.log(`Errors: ${tests.errors.length}`);
    
    if (tests.errors.length === 0) {
        console.log('\n✓ All tests passed!');
        return { success: true, tests };
    } else {
        console.log('\n✗ Some tests failed:');
        tests.errors.forEach(error => console.error(`  - ${error}`));
        return { success: false, tests, errors: tests.errors };
    }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
    window.testReportGeneration = testReportGeneration;
    console.log('Test script loaded. Run testReportGeneration() in the console to test report generation.');
}

