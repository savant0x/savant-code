## Freebuff Community Feedback & Action Report

Based on the recent logs from the `#feedback` channel, I have compiled a comprehensive report categorizing the top user complaints, recurring issues, and feature requests. The data indicates that while users are highly engaged with Freebuff, recent outages and unclear UI wording are the primary sources of friction.

---

### Executive Summary

The most critical issue disrupting user experience was an unplanned system outage tied to the DeepSeek API, which affected both the Desktop client and CLI. Beyond technical stability, the most frequent user complaints revolve around confusing reward mechanics (GLM sessions/streaks) and frustration with how session time is calculated.

---

### Top Complaints & Actionable Recommendations

The following table breaks down the highest-priority issues raised by the community and provides direct actions your team can take to resolve them.

| Issue Category | User Feedback Summary | Actionable Recommendation |
| --- | --- | --- |
| **System Outages** | DeepSeek API downtime caused widespread connection errors on both CLI and Desktop clients. | Implement fallback mechanisms or graceful error messages in the UI explaining the third-party API issue. |
| **Streak Perk Confusion** | Users (e.g., *Wheatley_*, *Eax*) are confused by the wording "+1 GLM 5.2 session each week," expecting sessions to stack rather than reset. | Update UI copy immediately to clarify the reset mechanic, or evaluate adopting the requested stacking system. |
| **Session Time Draining** | Users dislike that session limits are based on overall elapsed time rather than active LLM processing time. | Add a tooltip explaining that idle time limits are tied to ad-revenue requirements, or implement an auto-pause for extended inactivity. |
| **Compute Limit Errors** | Users are hitting vCPU/RAM limits and receiving confusing "Message not delivered" errors referencing invalid support emails (`support@vly.sh`). | Correct the support email address in error logs and provide clearer instructions on how to upgrade capacity. |

---

### Additional Feature Requests & Observations

Beyond the critical complaints, users discussed several quality-of-life improvements and feature expansions.

* **Regional Expansion:** Users in currently restricted areas (specifically requested: Slovakia) are asking for full access to the platform.
* **Third-Party Integration Friction:** Developers attempting to use custom instances (like Nodepod) are struggling because Freebuff's custom patches make the codebase proprietary and difficult to troubleshoot.
* **Workspace Management:** Users require clearer pathways for moving or transferring projects into the workspace environment.
* **UI Customization:** Desktop users expressed appreciation for the "Active colored tabs" feature, indicating that visual organization tools are well-received.

---

### Recommended Next Steps

1. **Immediate Priority:** Patch the text description for the GLM 5.2 streak perk to stop the influx of support questions regarding missing sessions.
2. **Short-term Priority:** Correct the invalid `support@vly.sh` email in your error catchers so users with compute limit issues can actually reach you.
3. **Long-term Priority:** Review the architecture dependency on the DeepSeek API to see if a routing alternative can be established during their outages.

Which of these action items would you like to prioritize for your next development sprint?