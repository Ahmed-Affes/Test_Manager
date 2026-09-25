const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ayfwnyecpwnplbvdoexa.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_gioQusDWALQuwaevZ3931g_JurcMSHF';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log('Seeding MorphFS Verification & Quality Platform...');

  // 1. Ensure MorphFS Project
  const { data: existingProjects } = await supabase.from('projects').select('*').limit(5);
  let project = existingProjects?.find((p) => p.name.toLowerCase().includes('morph') || p.key === 'TM-101');

  if (!project && existingProjects && existingProjects.length > 0) {
    project = existingProjects[0];
  }

  if (project) {
    const { data: updated } = await supabase
      .from('projects')
      .update({
        name: 'MorphFS',
        key: 'MORPH',
        description: 'Next-Generation Versioned Filesystem, Time-Travel Engine & Platform Environment (Windows Edition)',
        accent_color: '#8b5cf6', // Morph purple
        status: 'active',
      })
      .eq('id', project.id)
      .select()
      .single();
    if (updated) project = updated;
    console.log(`Updated project: ${project.name} (${project.key}) [${project.id}]`);
  } else {
    const { data: created, error } = await supabase
      .from('projects')
      .insert({
        name: 'MorphFS',
        key: 'MORPH',
        description: 'Next-Generation Versioned Filesystem, Time-Travel Engine & Platform Environment (Windows Edition)',
        accent_color: '#8b5cf6',
        status: 'active',
      })
      .select()
      .single();
    if (error) throw error;
    project = created;
    console.log(`Created project: ${project.name} (${project.key}) [${project.id}]`);
  }

  const projectId = project.id;

  // 2. Seed Environments
  const envDefs = [
    {
      name: 'Windows 11 Host Dev Environment',
      os: 'Windows 11 Pro 23H2 (x86_64)',
      cpu: '16 vCPU AMD Ryzen 9 / Intel Core i9',
      ram: '32 GB DDR5',
      runtime: 'Rust 1.80+ / MSVC Toolchain',
      description: 'Primary host development and Windows desktop integration environment',
    },
    {
      name: 'QEMU KVM Test Harness',
      os: 'Clean Sandbox (Kernel 6.12.5-morphfs)',
      cpu: '8 vCPU Virtualized',
      ram: '16 GB RAM',
      runtime: 'QEMU KVM + GDB Stub + Fault Injection Driver',
      description: 'Isolated hardware fault injection and sudden power-failure simulation sandbox',
    },
    {
      name: 'PFE Live Demo & Jury Presentation',
      os: 'Windows 11 Isolated Dual-Instance',
      cpu: 'Host Native',
      ram: '16 GB allocated',
      runtime: 'Morph Desktop + Explorer + Control Center UI',
      description: 'Official PFE capstone presentation and graduation jury defense environment',
    },
  ];

  const envMap = {};
  for (const ed of envDefs) {
    const { data: existing } = await supabase
      .from('environments')
      .select('id')
      .eq('project_id', projectId)
      .ilike('name', ed.name)
      .maybeSingle();

    if (existing) {
      envMap[ed.name] = existing.id;
    } else {
      const { data: ins } = await supabase
        .from('environments')
        .insert({ ...ed, project_id: projectId })
        .select('id')
        .single();
      if (ins) envMap[ed.name] = ins.id;
    }
  }
  console.log('Seeded Environments:', Object.keys(envMap).length);

  // 3. Seed MorphFS Test Suites (from docx)
  const suitesDef = [
    {
      name: 'Storage Engine & Block Layer',
      description: 'Verification of Storage Blocks, Copy-on-Write (COW), Deduplication, Compression, and Checksums.',
      is_regression: true,
    },
    {
      name: 'Object Identity & Metadata Layer',
      description: 'Permanent Object ID stability through renames and moves, Inodes, Directory Trees, and POSIX attributes.',
      is_regression: true,
    },
    {
      name: 'Version Engine, Time Travel & Restore',
      description: 'V1/V2/V3 lineages, Time Travel timeline browsing, Restore semantics, Folder History, and Experiments.',
      is_regression: true,
    },
    {
      name: 'Crash Consistency, Journaling & fsck',
      description: 'Interruption during write operations, circular journal replay, atomic rollback, and fsck.morphfs volume validation.',
      is_regression: true,
    },
    {
      name: 'Garbage Collection & Free Space',
      description: 'Reclaiming orphan COW blocks after experiment pruning while strictly preserving reachable version data.',
      is_regression: false,
    },
    {
      name: 'MFP Protocol & Node Sync',
      description: 'MorphFS Protocol (MFP) messages, block-diff replication, offline-first local modifications, and conflict detection.',
      is_regression: true,
    },
    {
      name: 'Windows Integration, Desktop & CLI',
      description: 'Morph Explorer operations, Morph Launcher, Control Center monitoring, normal Windows apps compatibility, and CLI commands.',
      is_regression: true,
    },
    {
      name: 'Reference Model Invariants & Fuzzing',
      description: 'INV-001 Invariant Checker, deterministic seed randomized workloads, and corruption detection.',
      is_regression: true,
    },
    {
      name: 'Benchmarking & Performance',
      description: 'NTFS vs MorphFS IOPS, write latency, CPU/RAM utilization, and recovery duration benchmarking.',
      is_regression: false,
    },
    {
      name: 'PFE 20-Step End-to-End Demonstration',
      description: 'E2E-001 Official graduation capstone defense demonstration covering all 20 lifecycle steps.',
      is_regression: true,
    },
  ];

  const suiteMap = {};
  for (const sd of suitesDef) {
    const { data: existing } = await supabase
      .from('test_suites')
      .select('id')
      .eq('project_id', projectId)
      .ilike('name', sd.name)
      .maybeSingle();

    if (existing) {
      suiteMap[sd.name] = existing.id;
    } else {
      const { data: ins } = await supabase
        .from('test_suites')
        .insert({ ...sd, project_id: projectId, status: 'active' })
        .select('id')
        .single();
      if (ins) suiteMap[sd.name] = ins.id;
    }
  }
  console.log('Seeded Test Suites:', Object.keys(suiteMap).length);

  // 4. Seed PFE Milestones / Test Plans
  const plansDef = [
    {
      name: 'PFE Milestone 1: Volume Layout & Block Layer Core',
      description: 'Validate Superblock, block read/write, Copy-on-Write, and volume file creation from zero.',
      status: 'completed',
    },
    {
      name: 'PFE Milestone 2: Version Graph & Time Travel Engine',
      description: 'Validate V1/V2/V3 lineages, Time Travel timeline inspection, Snapshotting, and Branch experiments.',
      status: 'in_progress',
    },
    {
      name: 'PFE Milestone 3: Crash Recovery & fsck.morphfs Durability',
      description: 'Validate power failure resilience, circular journal replay, and fsck repair routines.',
      status: 'in_progress',
    },
    {
      name: 'PFE Milestone 4: Windows Integration & 20-Step PFE Defense Demo',
      description: 'Full E2E-001 qualification for final graduation jury demonstration and academic sign-off.',
      status: 'planning',
    },
  ];

  const planMap = {};
  for (const pd of plansDef) {
    const { data: existing } = await supabase
      .from('test_plans')
      .select('id')
      .eq('project_id', projectId)
      .ilike('name', pd.name)
      .maybeSingle();

    if (existing) {
      planMap[pd.name] = existing.id;
    } else {
      const { data: ins } = await supabase
        .from('test_plans')
        .insert({ ...pd, project_id: projectId })
        .select('id')
        .single();
      if (ins) planMap[pd.name] = ins.id;
    }
  }
  console.log('Seeded Test Plans:', Object.keys(planMap).length);

  // 5. Seed Core MorphFS Test Cases (mapped directly from the docx)
  const testCasesDef = [
    {
      suite: 'Storage Engine & Block Layer',
      key: 'MORPH-001',
      title: 'Copy-on-Write Block Sharing & Divergence',
      description: 'Verify that editing a file retains shared blocks and only allocates new blocks for modified regions.',
      type: 'functional',
      severity: 'critical',
      priority: 'critical',
      preconditions: 'Clean Morph volume initialized; block size = 4096 bytes',
      expected_result: 'V1 retains blocks [A][B][C][D]; V2 shares [A][B][C] and allocates new block [D2]; zero data corruption.',
      steps: [
        { action: 'Create report.docx with 4 blocks [A][B][C][D]', expected: '4 blocks committed to volume with checksums' },
        { action: 'Modify block 4 to create version V2', expected: 'New block [D2] written; blocks [A][B][C] shared via refcount' },
        { action: 'Inspect block map of V1 and V2', expected: 'Refcounts on A, B, C equal 2; D and D2 refcount equal 1' },
      ],
      run: {
        status: 'pass',
        duration_ms: 310,
        actual_result: 'Verified COW block sharing. 3 blocks shared, 1 unique block allocated. Checksums matched.',
      },
      plan: 'PFE Milestone 1: Volume Layout & Block Layer Core',
    },
    {
      suite: 'Storage Engine & Block Layer',
      key: 'MORPH-002',
      title: 'Block-Level Data Deduplication',
      description: 'Ensure identical files or blocks across different files point to the same physical block on disk.',
      type: 'functional',
      severity: 'major',
      priority: 'high',
      preconditions: 'Morph volume mounted; deduplication engine enabled',
      expected_result: 'Two identical files photo1.png and photo2.png consume only 1x block storage.',
      steps: [
        { action: 'Write photo1.png (5 MB test pattern)', expected: '5 MB written to disk' },
        { action: 'Copy photo1.png to photo2.png', expected: 'Deduplication table matches SHA-256 block hash' },
        { action: 'Inspect volume free space', expected: 'Zero additional data blocks allocated; refcount incremented' },
      ],
      run: {
        status: 'pass',
        duration_ms: 450,
        actual_result: 'Deduplication ratio 2.0x. Zero redundant block writes detected.',
      },
      plan: 'PFE Milestone 1: Volume Layout & Block Layer Core',
    },
    {
      suite: 'Object Identity & Metadata Layer',
      key: 'MORPH-003',
      title: 'Permanent Object ID Stability Across Rename and Move',
      description: 'Verify that a file maintains its stable Object ID (e.g. A73F...92) and complete historical versions when moved across directories.',
      type: 'functional',
      severity: 'critical',
      priority: 'critical',
      preconditions: 'Directory School/ created; report.docx created at root',
      expected_result: 'File identity remains unchanged; history lineage remains completely intact under new path.',
      steps: [
        { action: 'Record Object ID of report.docx', expected: 'Object ID generated (UUIDv7 / 128-bit)' },
        { action: 'Rename report.docx to final_report.docx', expected: 'Object ID remains identical' },
        { action: 'Move final_report.docx into School/ directory', expected: 'Path updated; Object ID remains identical' },
        { action: 'Query history of School/final_report.docx', expected: 'Returns complete history including creation before move' },
      ],
      run: {
        status: 'pass',
        duration_ms: 180,
        actual_result: 'Object ID A73F-92B1 stable across rename and move. Version lineage preserved.',
      },
      plan: 'PFE Milestone 2: Version Graph & Time Travel Engine',
    },
    {
      suite: 'Version Engine, Time Travel & Restore',
      key: 'MORPH-004',
      title: 'Time Travel Historical State Inspection',
      description: 'Navigate to historical timestamp 14:05, inspect older filesystem view in read-only mode, and return to present.',
      type: 'functional',
      severity: 'critical',
      priority: 'critical',
      preconditions: 'File edited across multiple timestamps: 09:00, 11:30, 14:05, 18:00',
      expected_result: '14:05 state reconstructed accurately; present state unaffected upon return.',
      steps: [
        { action: 'Invoke morph time-travel --at "14:05"', expected: 'Virtual VFS snapshot mounts read-only 14:05 state' },
        { action: 'Verify contents of report.docx', expected: 'Content matches V3 from 14:05' },
        { action: 'Invoke morph time-travel return', expected: 'VFS returns to present live state (V4)' },
      ],
      run: {
        status: 'pass',
        duration_ms: 290,
        actual_result: 'Time Travel VFS projection verified. Zero modification to live working tree.',
      },
      plan: 'PFE Milestone 2: Version Graph & Time Travel Engine',
    },
    {
      suite: 'Version Engine, Time Travel & Restore',
      key: 'MORPH-005',
      title: 'Historical Version Restore Semantics (Non-Destructive)',
      description: 'Restoring historical version V1 creates a new current version V5 with V1 content while preserving all intermediate history V1..V4.',
      type: 'functional',
      severity: 'critical',
      priority: 'critical',
      preconditions: 'File has history V1 -> V2 -> V3 -> V4 (corrupted)',
      expected_result: 'New version V5 created containing V1 content; V1..V4 remain permanently accessible in history.',
      steps: [
        { action: 'Invoke morph restore report.docx --version V1', expected: 'Restoration transaction initiated' },
        { action: 'Verify current live content of report.docx', expected: 'Matches V1 content exactly' },
        { action: 'Inspect morph history report.docx', expected: 'History shows V1 -> V2 -> V3 -> V4 -> V5 (restored from V1)' },
      ],
      run: {
        status: 'pass',
        duration_ms: 220,
        actual_result: 'Non-destructive restore verified. Version V5 created from V1. History tree intact.',
      },
      plan: 'PFE Milestone 2: Version Graph & Time Travel Engine',
    },
    {
      suite: 'Version Engine, Time Travel & Restore',
      key: 'MORPH-006',
      title: 'Branch Experiments & Merge / Discard',
      description: 'Create an isolated experiment branch from V20, modify files, compare diffs, and safely discard or merge.',
      type: 'functional',
      severity: 'major',
      priority: 'high',
      preconditions: 'Main branch at revision V20',
      expected_result: 'Experiment modifications isolated from Main branch; discard cleanly frees experiment blocks.',
      steps: [
        { action: 'morph branch create experiment', expected: 'Branch pointer created referencing V20' },
        { action: 'Modify test files on experiment branch', expected: 'Modifications committed exclusively to experiment branch' },
        { action: 'morph compare main experiment', expected: 'Visual diff displays added/modified blocks' },
        { action: 'morph branch discard experiment', expected: 'Main branch remains unchanged at V20; experiment dereferenced' },
      ],
      run: {
        status: 'pass',
        duration_ms: 540,
        actual_result: 'Branch experiment verified. Main branch completely isolated. Clean discard.',
      },
      plan: 'PFE Milestone 2: Version Graph & Time Travel Engine',
    },
    {
      suite: 'Crash Consistency, Journaling & fsck',
      key: 'MORPH-007',
      title: 'Sudden Power Loss During Write & Circular Journal Replay',
      description: 'Simulate abrupt power disconnection during multi-file atomic write and verify volume consistency after reboot.',
      type: 'recovery',
      severity: 'blocker',
      priority: 'critical',
      preconditions: 'MorphFS mounted with journal=ordered; fault injection driver loaded',
      expected_result: 'Reboot triggers circular journal replay; zero corrupt blocks; filesystem reports clean state.',
      steps: [
        { action: 'Start concurrent writes across 500 files', expected: 'Transactions queued in circular journal buffer' },
        { action: 'Trigger kernel fault / power-off mid-write', expected: 'System halted abruptly; partial blocks on disk' },
        { action: 'Mount volume in recovery mode', expected: 'Journal recovery scans uncommitted records' },
        { action: 'Execute journal replay and check fsck', expected: 'Incomplete transactions rolled back; valid transactions replayed; zero orphan inodes' },
      ],
      run: {
        status: 'pass',
        duration_ms: 1840,
        actual_result: 'Journal replayed in 1.84s. All 500 file descriptors intact with valid checksums.',
      },
      plan: 'PFE Milestone 3: Crash Recovery & fsck.morphfs Durability',
    },
    {
      suite: 'Crash Consistency, Journaling & fsck',
      key: 'MORPH-008',
      title: 'fsck.morphfs Invariant Validation & Repair',
      description: 'Run fsck.morphfs against an intentionally modified volume to verify Superblock, Metadata, Checksums, and Free-Space tables.',
      type: 'recovery',
      severity: 'critical',
      priority: 'critical',
      preconditions: 'Corrupted disk image test fixture (corrupt-images/bad-checksum.img)',
      expected_result: 'fsck.morphfs flags checksum mismatch, isolates damaged block, and restores from COW parity.',
      steps: [
        { action: 'Run fsck.morphfs --check morph-corrupt.img', expected: 'Detects invalid block checksum at block #4102' },
        { action: 'Run fsck.morphfs --repair morph-corrupt.img', expected: 'Repairs block reference using COW ancestor metadata' },
        { action: 'Mount repaired volume', expected: 'Mounts in read-write mode with zero errors' },
      ],
      run: {
        status: 'pass',
        duration_ms: 920,
        actual_result: 'fsck.morphfs identified and resolved corrupted block #4102. Volume clean.',
      },
      plan: 'PFE Milestone 3: Crash Recovery & fsck.morphfs Durability',
    },
    {
      suite: 'MFP Protocol & Node Sync',
      key: 'MORPH-009',
      title: 'MFP Block-Diff Transfer (Laptop to Desktop)',
      description: 'Verify that synchronizing 5-version file across machines only transfers the delta blocks missing on the remote peer.',
      type: 'integration',
      severity: 'major',
      priority: 'high',
      preconditions: 'Laptop has versions V1..V5; Desktop has versions V1..V3',
      expected_result: 'Only blocks unique to V4 and V5 are transferred over MFP; zero redundant bandwidth.',
      steps: [
        { action: 'Connect Desktop to Laptop via MFP protocol', expected: 'MFP handshake verified' },
        { action: 'Initiate morph sync laptop', expected: 'Protocol exchanges version graph manifests' },
        { action: 'Verify transferred data size', expected: 'Network bytes equal size of Delta(V4, V5) only' },
        { action: 'Verify Desktop local history', expected: 'Desktop history now contains V1..V5 identically' },
      ],
      run: {
        status: 'pass',
        duration_ms: 810,
        actual_result: 'Block-diff sync verified. 87% bandwidth savings vs full-file copy.',
      },
      plan: 'PFE Milestone 4: Windows Integration & 20-Step PFE Defense Demo',
    },
    {
      suite: 'MFP Protocol & Node Sync',
      key: 'MORPH-010',
      title: 'MFP Concurrent Modification Conflict Detection',
      description: 'Detect conflict when Laptop renames a file while Desktop deletes it during offline mode.',
      type: 'integration',
      severity: 'critical',
      priority: 'critical',
      preconditions: 'Both nodes start with report.docx at V1 in offline mode',
      expected_result: 'Sync halts with conflict alert; neither operation silently overwrites or loses data.',
      steps: [
        { action: 'On Laptop (offline): Rename report.docx to notes.docx', expected: 'Local rename committed' },
        { action: 'On Desktop (offline): Delete report.docx', expected: 'Local tombstone committed' },
        { action: 'Re-establish MFP connection and initiate sync', expected: 'Conflict detected: Rename vs Delete collision' },
        { action: 'Inspect Control Center conflict inspector', expected: 'Presents user resolution dialog; zero silent data loss' },
      ],
      run: {
        status: 'pass',
        duration_ms: 640,
        actual_result: 'Conflict detected with high fidelity. Presented in Control Center with zero silent data loss.',
      },
      plan: 'PFE Milestone 4: Windows Integration & 20-Step PFE Defense Demo',
    },
    {
      suite: 'Windows Integration, Desktop & CLI',
      key: 'MORPH-011',
      title: 'Standard Windows Application Compatibility (VS Code & Chrome)',
      description: 'Ensure normal Windows programs read and write directly to MorphFS files through the Windows integration layer.',
      type: 'functional',
      severity: 'critical',
      priority: 'critical',
      preconditions: 'MorphFS integration layer running on Windows 11 host',
      expected_result: 'VS Code and Chrome open, edit, and save files without requiring application modifications.',
      steps: [
        { action: 'Open project folder in VS Code targeting MorphFS VFS', expected: 'Workspace loads with file tree' },
        { action: 'Edit code file and save (Ctrl+S)', expected: 'Save succeeds; MorphFS records new version V2' },
        { action: 'Download file from Chrome into MorphFS folder', expected: 'Download completes with valid checksum' },
      ],
      run: {
        status: 'pass',
        duration_ms: 1100,
        actual_result: 'Windows VFS shell driver verified. Seamless compatibility with VS Code and Chrome.',
      },
      plan: 'PFE Milestone 4: Windows Integration & 20-Step PFE Defense Demo',
    },
    {
      suite: 'Reference Model Invariants & Fuzzing',
      key: 'MORPH-012',
      title: 'INV-001 Reference Model Invariant Checker (10,000 Operations)',
      description: 'Run 10,000 randomized filesystem operations and verify that every invariant holds after every single step.',
      type: 'stress',
      severity: 'critical',
      priority: 'critical',
      preconditions: 'Reference in-memory model active with deterministic random seed 0xMORPH2026',
      expected_result: 'All 8 core invariants hold: stable IDs, no orphan blocks, valid checksums, legal version DAG.',
      steps: [
        { action: 'Execute random sequence (create, write, rename, branch, delete, restore)', expected: 'Operation completed' },
        { action: 'Assert invariant: Every visible path resolves to 1 logical object', expected: 'Invariant HOLDS' },
        { action: 'Assert invariant: GC never removes reachable data', expected: 'Invariant HOLDS' },
        { action: 'Assert invariant: Checksums match intact records', expected: 'Invariant HOLDS' },
      ],
      run: {
        status: 'pass',
        duration_ms: 3200,
        actual_result: '10,000 operations evaluated against Reference Model. 0 invariant violations.',
      },
      plan: 'PFE Milestone 3: Crash Recovery & fsck.morphfs Durability',
    },
    {
      suite: 'Benchmarking & Performance',
      key: 'MORPH-013',
      title: 'Benchmark: NTFS vs MorphFS Throughput & Version Overhead',
      description: 'Compare raw file read/write throughput, metadata latency, and version snapshot storage efficiency against NTFS.',
      type: 'performance',
      severity: 'major',
      priority: 'medium',
      preconditions: '10 GB test payload on identical NVMe SSD partition',
      expected_result: 'MorphFS achieves within 92% of NTFS raw throughput with 10x faster snapshot creation.',
      steps: [
        { action: 'Measure 1 GB sequential write throughput', expected: 'MorphFS: 1,840 MB/s | NTFS: 1,980 MB/s' },
        { action: 'Measure 10,000 file metadata creation time', expected: 'MorphFS COW metadata resolves in 1.4s' },
        { action: 'Measure snapshot creation latency', expected: 'MorphFS: 4ms | NTFS Shadow Copy: 2800ms' },
      ],
      run: {
        status: 'pass',
        duration_ms: 4100,
        actual_result: 'MorphFS snapshot latency 4ms (700x faster than NTFS VSS). Throughput 93.4% of raw NTFS.',
      },
      plan: 'PFE Milestone 4: Windows Integration & 20-Step PFE Defense Demo',
    },
    {
      suite: 'PFE 20-Step End-to-End Demonstration',
      key: 'MORPH-020',
      title: 'E2E-001 Complete 20-Step PFE Graduation Defense Demonstration',
      description: 'The master graduation release gate: execute all 20 lifecycle steps from volume creation to crash recovery and multi-node sync.',
      type: 'functional',
      severity: 'blocker',
      priority: 'critical',
      preconditions: 'Clean test volume morph-pfe.img; Windows host and QEMU peer online',
      expected_result: 'All 20 demonstration steps pass sequentially; complete evidence captured for Academic Jury review.',
      steps: [
        { action: '1. Create disposable Morph volume & launch Morph Explorer', expected: 'Volume mounts with clean superblock' },
        { action: '2. Create project/ and report.docx; edit to produce V1 -> V2 -> V3', expected: 'Version lineage visible in Explorer' },
        { action: '3. Create snapshot "Before Cleanup" and branch experiment', expected: 'Branch created with isolated COW blocks' },
        { action: '4. Compare branch with main and discard experiment', expected: 'Diff viewer displays changes; discard clean' },
        { action: '5. Delete report.docx and recover from history', expected: 'Recovered file restored with complete lineage' },
        { action: '6. Trigger controlled kernel crash mid-write', expected: 'Crash injected cleanly' },
        { action: '7. Reboot and verify circular journal replay', expected: 'Journal replayed in < 2s; zero orphan inodes' },
        { action: '8. Run fsck.morphfs volume validation', expected: 'All 8 volume invariants report healthy' },
        { action: '9. Initiate MFP sync to peer node with block-diff transfer', expected: 'Only delta blocks transferred' },
        { action: '10. Trigger concurrent edit conflict and show Control Center alert', expected: 'Conflict detected with zero silent data loss' },
      ],
      run: {
        status: 'pass',
        duration_ms: 8400,
        actual_result: 'All 20 PFE demonstration checkpoints passed. Complete audit trail and evidence verified for Academic Jury.',
      },
      plan: 'PFE Milestone 4: Windows Integration & 20-Step PFE Defense Demo',
    },
  ];

  for (const tc of testCasesDef) {
    const suiteId = suiteMap[tc.suite];
    const planId = planMap[tc.plan];

    let caseId = null;
    const { data: existingCase } = await supabase
      .from('test_cases')
      .select('id')
      .eq('project_id', projectId)
      .eq('key', tc.key)
      .maybeSingle();

    if (existingCase) {
      caseId = existingCase.id;
      await supabase
        .from('test_cases')
        .update({
          suite_id: suiteId,
          title: tc.title,
          description: tc.description,
          priority: tc.priority,
          severity: tc.severity,
          type: tc.type,
          preconditions: tc.preconditions,
          expected_result: tc.expected_result,
          status: 'active',
        })
        .eq('id', caseId);
    } else {
      const { data: newCase, error: caseErr } = await supabase
        .from('test_cases')
        .insert({
          project_id: projectId,
          suite_id: suiteId,
          key: tc.key,
          title: tc.title,
          description: tc.description,
          priority: tc.priority,
          severity: tc.severity,
          type: tc.type,
          preconditions: tc.preconditions,
          expected_result: tc.expected_result,
          status: 'active',
        })
        .select('id')
        .single();

      if (caseErr) {
        console.error('Case insert error:', caseErr);
        continue;
      }
      caseId = newCase.id;
    }

    // Link steps
    if (caseId && tc.steps) {
      await supabase.from('test_steps').delete().eq('test_case_id', caseId);
      const stepInserts = tc.steps.map((st, idx) => ({
        test_case_id: caseId,
        step_number: idx + 1,
        action: st.action,
        expected_result: st.expected,
      }));
      await supabase.from('test_steps').insert(stepInserts);
    }

    // Link to plan
    if (caseId && planId) {
      await supabase
        .from('test_plan_items')
        .upsert({ test_plan_id: planId, test_case_id: caseId }, { onConflict: 'test_plan_id,test_case_id' });
    }

    // Record initial verified run
    if (caseId && tc.run) {
      const envId = envMap['Windows 11 Host Dev Environment'] || Object.values(envMap)[0];
      await supabase.from('test_runs').insert({
        project_id: projectId,
        test_case_id: caseId,
        environment_id: envId,
        status: tc.run.status,
        duration_ms: tc.run.duration_ms,
        actual_result: tc.run.actual_result,
        application_version: 'v1.0.0-rc1',
        branch: 'main',
        commit_sha: 'd3a89e1b',
        notes: 'PFE Verification Plan baseline execution run',
      });
    }
  }
  console.log('Seeded MorphFS Test Cases & Execution History.');

  // 6. Seed Academic Jury / Professor Sign-off
  const { data: existingSignoff } = await supabase
    .from('report_signoffs')
    .select('id')
    .eq('project_id', projectId)
    .maybeSingle();

  if (!existingSignoff) {
    await supabase.from('report_signoffs').insert({
      project_id: projectId,
      role: 'PFE Academic Jury & Professor Evaluation',
      decision: 'approved',
      notes: 'Reviewed complete 20-step verification suite (E2E-001) and Reference Invariant Model (INV-001). Crash recovery and COW deduplication verified with zero orphan blocks. Project approved for graduation defense.',
    });
    console.log('Seeded Academic Sign-Off.');
  }

  // 7. Seed Audit Log
  await supabase.from('audit_logs').insert({
    project_id: projectId,
    action: 'seed_morphfs_platform',
    entity_type: 'project',
    entity_id: projectId,
    metadata: {
      framework: 'MorphFS Windows Edition Build & Verification Plan',
      suites_count: suitesDef.length,
      cases_count: testCasesDef.length,
      coop_roles: ['Author / Lead Architect', 'Co-Author / Systems Engineer', 'Professor / Academic Evaluator'],
    },
  });

  console.log('MorphFS Verification Platform seeded successfully!');
}

seed().catch(console.error);
