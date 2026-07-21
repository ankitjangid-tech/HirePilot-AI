const pool = require("../config/db");
const {
  buildEmailHtml,
  getEmailDeliveryMessage,
  sendEmail,
} = require("../services/emailService");
const {
  runCrawl4AiDemoDiscovery: runExternalCrawl4AiDemoDiscovery,
  runAllowlistedSourceDiscovery: runExternalAllowlistedSourceDiscovery,
} = require("./externalJobController");

const RECRUITER_STATUSES = ["pending", "approved", "blocked"];
const EXTERNAL_JOB_REVIEW_STATUSES = [
  "pending_review",
  "approved",
  "hidden",
  "rejected",
];
const EXTERNAL_SOURCE_TYPES = [
  "demo_raw_html",
  "simulated_platform",
  "company_career_page",
  "job_board",
];
const EXTERNAL_SOURCE_TRUST_STATUSES = ["pending", "approved", "blocked"];
const COMPANY_VERIFICATION_STATUSES = [
  "pending",
  "verified",
  "rejected",
  "needs_review",
];

const optionalText = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value).trim() || null;
};

const isValidPublicSourceReference = (value) => {
  try {
    const parsed = new URL(String(value || "").trim());
    const hostname = parsed.hostname.toLowerCase();
    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password &&
      hostname !== "localhost" &&
      !hostname.endsWith(".localhost") &&
      !hostname.endsWith(".local")
    );
  } catch (error) {
    return false;
  }
};

const sendRecruiterStatusEmail = async (recruiter, recruiterStatus, reason) => {
  const approved = recruiterStatus === "approved";
  const subject = approved
    ? "Your HirePilot recruiter account is approved"
    : "Your HirePilot recruiter account has been blocked";
  const title = approved
    ? "Recruiter account approved"
    : "Recruiter account blocked";
  const paragraphs = approved
    ? [
        "Your Recruiter Workspace is approved, and you can now publish jobs on HirePilot AI.",
        "Company verification remains a separate trust review shown to Candidates.",
      ]
    : [
        "Your Recruiter account has been blocked, and job publishing is unavailable.",
        reason || "Contact the HirePilot administrator if you need more information.",
      ];

  return sendEmail(
    recruiter.email,
    subject,
    buildEmailHtml({
      recipientName: recruiter.full_name,
      title,
      paragraphs,
      details: [{ label: "Account status", value: recruiterStatus }],
    })
  );
};

const sendCompanyVerificationEmail = async ({
  company,
  recruiter,
  verificationStatus,
}) => {
  const contentByStatus = {
    verified: {
      subject: `${company.company_name} is verified on HirePilot AI`,
      title: "Company profile verified",
      paragraphs: [
        `${company.company_name} has been verified by a HirePilot administrator.`,
        "Candidates can now see the Verified Employer trust indicator on eligible jobs.",
      ],
    },
    rejected: {
      subject: `Company verification update for ${company.company_name}`,
      title: "Company verification rejected",
      paragraphs: [
        `${company.company_name} was not approved during the current verification review.`,
        company.verification_notes ||
          "Review the Company Profile tab and contact the HirePilot administrator if clarification is needed.",
      ],
    },
    needs_review: {
      subject: `Company profile needs review: ${company.company_name}`,
      title: "Company profile needs additional review",
      paragraphs: [
        `${company.company_name} requires additional review before it can be shown as a verified employer.`,
        company.verification_notes ||
          "Review the Company Profile tab for the latest verification guidance.",
      ],
    },
  };
  const content = contentByStatus[verificationStatus];

  if (!content) {
    return null;
  }

  return sendEmail(
    recruiter.email,
    content.subject,
    buildEmailHtml({
      recipientName: recruiter.full_name,
      title: content.title,
      paragraphs: content.paragraphs,
      details: [
        { label: "Company", value: company.company_name },
        { label: "Verification status", value: verificationStatus.replace(/_/g, " ") },
      ],
    })
  );
};

const getRecruiters = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        user_id,
        full_name,
        email,
        COALESCE(recruiter_status, 'pending') AS recruiter_status,
        recruiter_status_reason,
        recruiter_status_updated_at,
        created_at
       FROM users
       WHERE role = 'recruiter'
       ORDER BY
         CASE COALESCE(recruiter_status, 'pending')
           WHEN 'pending' THEN 1
           WHEN 'blocked' THEN 2
           ELSE 3
         END,
         created_at DESC,
         user_id DESC`
    );

    return res.status(200).json({
      recruiters: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.log("ADMIN RECRUITER LIST ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to fetch recruiters",
    });
  }
};

const updateRecruiterStatus = async (req, res) => {
  try {
    const recruiterUserId = Number(req.params.userId);
    const recruiterStatus = String(req.body.recruiter_status || "").toLowerCase();
    const statusReason = req.body.recruiter_status_reason
      ? String(req.body.recruiter_status_reason).trim()
      : null;

    if (!recruiterUserId) {
      return res.status(400).json({
        error: "Valid recruiter user id is required",
      });
    }

    if (!RECRUITER_STATUSES.includes(recruiterStatus)) {
      return res.status(400).json({
        error: "Recruiter status must be pending, approved, or blocked",
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET recruiter_status = $2,
           recruiter_status_reason = $3,
           recruiter_status_updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       AND role = 'recruiter'
       AND COALESCE(recruiter_status, 'pending') <> $2
       RETURNING
         user_id,
         full_name,
         email,
         recruiter_status,
         recruiter_status_reason,
         recruiter_status_updated_at,
         created_at`,
      [
        recruiterUserId,
        recruiterStatus,
        recruiterStatus === "approved" ? null : statusReason,
      ]
    );

    if (result.rows.length === 0) {
      const existingResult = await pool.query(
        `SELECT
          user_id,
          full_name,
          email,
          COALESCE(recruiter_status, 'pending') AS recruiter_status,
          recruiter_status_reason,
          recruiter_status_updated_at,
          created_at
         FROM users
         WHERE user_id = $1
         AND role = 'recruiter'`,
        [recruiterUserId]
      );

      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          error: "Recruiter account not found",
        });
      }

      return res.status(200).json({
        message: `Recruiter account is already ${recruiterStatus}. No email was sent.`,
        recruiter: existingResult.rows[0],
        email_delivery: {
          sent: false,
          configured: null,
          status: "skipped_unchanged",
        },
      });
    }

    const recruiter = result.rows[0];
    const emailDelivery = ["approved", "blocked"].includes(recruiterStatus)
      ? await sendRecruiterStatusEmail(
          recruiter,
          recruiterStatus,
          recruiter.recruiter_status_reason
        )
      : null;
    const emailMessage = emailDelivery
      ? ` ${getEmailDeliveryMessage(emailDelivery)}`
      : "";

    return res.status(200).json({
      message: `Recruiter account ${recruiterStatus}.${emailMessage}`,
      recruiter,
      email_delivery: emailDelivery,
    });
  } catch (error) {
    console.log("ADMIN RECRUITER STATUS UPDATE ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to update recruiter status",
    });
  }
};

const getExternalJobs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        ej.external_job_id,
        ej.job_title,
        ej.company_name,
        ej.source_platform,
        ej.job_url,
        ej.required_skills,
        ej.experience_required,
        ej.location,
        ej.salary,
        ej.apply_mode,
        ej.is_active,
        ej.discovery_source,
        COALESCE(ej.review_status, 'approved') AS review_status,
        ej.review_notes,
        ej.reviewed_by,
        ej.reviewed_at,
        ej.discovered_at,
        ej.created_at,
        reviewer.full_name AS reviewed_by_name
       FROM external_jobs ej
       LEFT JOIN users reviewer
       ON reviewer.user_id = ej.reviewed_by
       ORDER BY
         CASE COALESCE(ej.review_status, 'approved')
           WHEN 'pending_review' THEN 1
           WHEN 'hidden' THEN 2
           WHEN 'rejected' THEN 3
           ELSE 4
         END,
         COALESCE(ej.discovered_at, ej.created_at) DESC,
         ej.external_job_id DESC`
    );

    return res.status(200).json({
      externalJobs: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.log("ADMIN EXTERNAL JOB LIST ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to fetch external jobs for review",
    });
  }
};

const reviewExternalJob = async (req, res) => {
  try {
    const externalJobId = Number(req.params.externalJobId);
    const reviewStatus = String(req.body.review_status || "").toLowerCase();
    const reviewNotes = req.body.review_notes
      ? String(req.body.review_notes).trim()
      : null;

    if (!externalJobId) {
      return res.status(400).json({
        error: "Valid external job id is required",
      });
    }

    if (!EXTERNAL_JOB_REVIEW_STATUSES.includes(reviewStatus)) {
      return res.status(400).json({
        error:
          "Review status must be pending_review, approved, hidden, or rejected",
      });
    }

    const result = await pool.query(
      `UPDATE external_jobs
       SET review_status = $2,
           review_notes = $3,
           reviewed_by = $4,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE external_job_id = $1
       RETURNING *`,
      [externalJobId, reviewStatus, reviewNotes, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "External job not found",
      });
    }

    return res.status(200).json({
      message: `External job marked ${reviewStatus.replace(/_/g, " ")}.`,
      externalJob: result.rows[0],
    });
  } catch (error) {
    console.log("ADMIN EXTERNAL JOB REVIEW ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to update external job review status",
    });
  }
};

const getExternalSources = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        external_source_id,
        source_name,
        source_key,
        source_type,
        base_url,
        is_enabled,
        trust_status,
        safety_mode,
        real_crawl_allowed,
        last_discovery_run_at,
        last_discovery_status,
        last_discovery_message,
        notes,
        created_by,
        created_at,
        updated_at
       FROM external_sources
       ORDER BY
         CASE source_key WHEN 'crawl4ai_demo' THEN 1 ELSE 2 END,
         created_at DESC,
         external_source_id DESC`
    );

    return res.status(200).json({
      externalSources: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.log("ADMIN EXTERNAL SOURCE LIST ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to fetch external discovery sources",
    });
  }
};

const createExternalSource = async (req, res) => {
  try {
    const sourceName = String(req.body.source_name || "").trim();
    const sourceKey = String(req.body.source_key || "").trim().toLowerCase();
    const sourceType = String(req.body.source_type || "").trim().toLowerCase();
    const trustStatus = String(
      req.body.trust_status || "pending"
    ).trim().toLowerCase();
    const safetyMode =
      String(req.body.safety_mode || "manual_review").trim() ||
      "manual_review";
    const isEnabled =
      typeof req.body.is_enabled === "boolean" ? req.body.is_enabled : false;

    if (!sourceName || !sourceKey || !sourceType) {
      return res.status(400).json({
        error: "Source name, source key, and source type are required",
      });
    }

    if (!/^[a-z0-9][a-z0-9_-]*$/.test(sourceKey)) {
      return res.status(400).json({
        error:
          "Source key must use lowercase letters, numbers, hyphens, or underscores",
      });
    }

    if (!EXTERNAL_SOURCE_TYPES.includes(sourceType)) {
      return res.status(400).json({
        error: `Source type must be one of: ${EXTERNAL_SOURCE_TYPES.join(", ")}`,
      });
    }

    if (!EXTERNAL_SOURCE_TRUST_STATUSES.includes(trustStatus)) {
      return res.status(400).json({
        error: "Trust status must be pending, approved, or blocked",
      });
    }

    const result = await pool.query(
      `INSERT INTO external_sources (
        source_name,
        source_key,
        source_type,
        base_url,
        is_enabled,
        trust_status,
        safety_mode,
        notes,
        created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        sourceName,
        sourceKey,
        sourceType,
        optionalText(req.body.base_url),
        isEnabled,
        trustStatus,
        safetyMode,
        optionalText(req.body.notes),
        req.user.user_id,
      ]
    );

    return res.status(201).json({
      message: "External discovery source created.",
      externalSource: result.rows[0],
    });
  } catch (error) {
    console.log("ADMIN EXTERNAL SOURCE CREATE ERROR:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "An external discovery source with this source key already exists",
      });
    }

    return res.status(500).json({
      error: "Unable to create external discovery source",
    });
  }
};

const updateExternalSource = async (req, res) => {
  try {
    const sourceId = Number(req.params.sourceId);
    const updates = [];
    const values = [sourceId];

    if (!sourceId) {
      return res.status(400).json({
        error: "Valid external source id is required",
      });
    }

    const currentResult = await pool.query(
      `SELECT
        is_enabled,
        trust_status,
        real_crawl_allowed,
        base_url,
        source_key
       FROM external_sources
       WHERE external_source_id = $1
       LIMIT 1`,
      [sourceId]
    );
    const currentSource = currentResult.rows[0];

    if (!currentSource) {
      return res.status(404).json({
        error: "External discovery source not found",
      });
    }

    const requestedTrustStatus =
      req.body.trust_status === undefined
        ? currentSource.trust_status
        : String(req.body.trust_status).trim().toLowerCase();
    const requestedEnabled =
      req.body.is_enabled === undefined
        ? currentSource.is_enabled
        : req.body.is_enabled;

    if (req.body.real_crawl_allowed !== undefined) {
      if (typeof req.body.real_crawl_allowed !== "boolean") {
        return res.status(400).json({
          error: "real_crawl_allowed must be true or false",
        });
      }

      if (
        req.body.real_crawl_allowed === true &&
        (
          requestedEnabled !== true ||
          requestedTrustStatus !== "approved" ||
          currentSource.source_key === "crawl4ai_demo" ||
          !isValidPublicSourceReference(currentSource.base_url)
        )
      ) {
        return res.status(400).json({
          error:
            "Use a public HTTP(S) URL, then approve and enable the source before allowing real read-only crawling.",
        });
      }

      values.push(req.body.real_crawl_allowed);
      updates.push(`real_crawl_allowed = $${values.length}`);
    } else if (
      requestedEnabled !== true ||
      requestedTrustStatus !== "approved"
    ) {
      updates.push("real_crawl_allowed = FALSE");
    }

    if (req.body.is_enabled !== undefined) {
      if (typeof req.body.is_enabled !== "boolean") {
        return res.status(400).json({
          error: "is_enabled must be true or false",
        });
      }

      values.push(req.body.is_enabled);
      updates.push(`is_enabled = $${values.length}`);
    }

    if (req.body.trust_status !== undefined) {
      const trustStatus = String(req.body.trust_status).trim().toLowerCase();

      if (!EXTERNAL_SOURCE_TRUST_STATUSES.includes(trustStatus)) {
        return res.status(400).json({
          error: "Trust status must be pending, approved, or blocked",
        });
      }

      values.push(trustStatus);
      updates.push(`trust_status = $${values.length}`);
    }

    if (req.body.notes !== undefined) {
      values.push(optionalText(req.body.notes));
      updates.push(`notes = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error:
          "Provide is_enabled, trust_status, real_crawl_allowed, or notes to update",
      });
    }

    const result = await pool.query(
      `UPDATE external_sources
       SET ${updates.join(", ")},
           updated_at = CURRENT_TIMESTAMP
       WHERE external_source_id = $1
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "External discovery source not found",
      });
    }

    return res.status(200).json({
      message: "External discovery source updated.",
      externalSource: result.rows[0],
    });
  } catch (error) {
    console.log("ADMIN EXTERNAL SOURCE UPDATE ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to update external discovery source",
    });
  }
};

const getRecruiterCompanies = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        rc.company_id,
        rc.recruiter_id,
        rc.company_name,
        rc.company_website,
        rc.industry,
        rc.company_size,
        rc.headquarters_location,
        rc.company_description,
        rc.verification_status,
        rc.verification_notes,
        rc.verified_by,
        rc.verified_at,
        rc.created_at,
        rc.updated_at,
        recruiter.full_name AS recruiter_name,
        recruiter.email AS recruiter_email,
        verifier.full_name AS verified_by_name
       FROM recruiter_companies rc
       JOIN users recruiter
       ON recruiter.user_id = rc.recruiter_id
       LEFT JOIN users verifier
       ON verifier.user_id = rc.verified_by
       ORDER BY
         CASE rc.verification_status
           WHEN 'needs_review' THEN 1
           WHEN 'pending' THEN 2
           WHEN 'rejected' THEN 3
           ELSE 4
         END,
         rc.updated_at DESC,
         rc.company_id DESC`
    );

    return res.status(200).json({
      companies: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.log("ADMIN COMPANY LIST ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to fetch recruiter company profiles",
    });
  }
};

const updateCompanyVerification = async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    const isNotesOnlyUpdate =
      req.body.verification_status === undefined &&
      req.body.verification_notes !== undefined;
    const updates = [];
    const values = [companyId];
    let verificationStatus = null;

    if (!companyId) {
      return res.status(400).json({
        error: "Valid company id is required",
      });
    }

    if (req.body.verification_status !== undefined) {
      verificationStatus = String(
        req.body.verification_status
      ).trim().toLowerCase();

      if (!COMPANY_VERIFICATION_STATUSES.includes(verificationStatus)) {
        return res.status(400).json({
          error:
            "Verification status must be pending, verified, rejected, or needs_review",
        });
      }

      values.push(verificationStatus);
      updates.push(`verification_status = $${values.length}`);

      if (verificationStatus === "verified") {
        values.push(req.user.user_id);
        updates.push(`verified_by = $${values.length}`);
        updates.push("verified_at = CURRENT_TIMESTAMP");
      } else {
        updates.push("verified_by = NULL");
        updates.push("verified_at = NULL");
      }
    }

    if (req.body.verification_notes !== undefined) {
      values.push(optionalText(req.body.verification_notes));
      updates.push(`verification_notes = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: "Provide verification_status or verification_notes to update",
      });
    }

    const previousCompanyResult = await pool.query(
      `SELECT
        rc.verification_status,
        rc.company_name,
        recruiter.full_name AS recruiter_name,
        recruiter.email AS recruiter_email
       FROM recruiter_companies rc
       JOIN users recruiter
       ON recruiter.user_id = rc.recruiter_id
       WHERE rc.company_id = $1`,
      [companyId]
    );

    if (previousCompanyResult.rows.length === 0) {
      return res.status(404).json({
        error: "Recruiter company profile not found",
      });
    }

    const previousCompany = previousCompanyResult.rows[0];

    const result = await pool.query(
      `UPDATE recruiter_companies
       SET ${updates.join(", ")},
           updated_at = CURRENT_TIMESTAMP
       WHERE company_id = $1
       RETURNING *`,
      values
    );

    const company = result.rows[0];
    const verificationChanged = Boolean(
      verificationStatus &&
        previousCompany.verification_status !== verificationStatus
    );
    const emailDelivery = verificationChanged
      ? await sendCompanyVerificationEmail({
          company,
          recruiter: {
            full_name: previousCompany.recruiter_name,
            email: previousCompany.recruiter_email,
          },
          verificationStatus,
        })
      : null;
    const baseMessage = isNotesOnlyUpdate
      ? "Company verification notes saved."
      : verificationChanged
      ? "Company verification updated."
      : "Company verification saved with no status change. No email was sent.";
    const emailMessage = emailDelivery
      ? ` ${getEmailDeliveryMessage(emailDelivery)}`
      : "";

    return res.status(200).json({
      message: `${baseMessage}${emailMessage}`,
      company,
      email_delivery: emailDelivery,
    });
  } catch (error) {
    console.log("ADMIN COMPANY VERIFICATION ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to update company verification",
    });
  }
};

const runCrawl4AiDemoDiscovery = async (req, res) => {
  const sendJson = res.json.bind(res);

  res.json = (payload = {}) => {
    const success = res.statusCode >= 200 && res.statusCode < 300;

    if (!success) {
      return sendJson({
        ...payload,
        success: false,
        message:
          payload.message ||
          payload.error ||
          "Crawl4AI demo discovery failed",
      });
    }

    return sendJson({
      success: true,
      message:
        payload.message || "Crawl4AI demo discovery completed",
      discovered_count: Number(payload.discovered_count || 0),
      inserted_count: Number(payload.inserted_count || 0),
      updated_count: Number(payload.updated_count || 0),
      jobs: Array.isArray(payload.jobs) ? payload.jobs : [],
    });
  };

  try {
    return await runExternalCrawl4AiDemoDiscovery(req, res);
  } catch (error) {
    console.log("ADMIN CRAWL4AI DEMO DISCOVERY ERROR:", error.message);

    return res.status(500).json({
      error: "Unable to run Crawl4AI demo discovery",
    });
  }
};

const runAllowlistedSourceDiscovery = async (req, res) => {
  try {
    return await runExternalAllowlistedSourceDiscovery(req, res);
  } catch (error) {
    console.log("ADMIN ALLOWLISTED DISCOVERY ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to run read-only allowlisted discovery",
    });
  }
};

module.exports = {
  getRecruiters,
  updateRecruiterStatus,
  getExternalJobs,
  reviewExternalJob,
  getExternalSources,
  createExternalSource,
  updateExternalSource,
  getRecruiterCompanies,
  updateCompanyVerification,
  runCrawl4AiDemoDiscovery,
  runAllowlistedSourceDiscovery,
};
