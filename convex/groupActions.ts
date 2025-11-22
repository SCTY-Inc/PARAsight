"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Generate a group name based on two links using AI
export const generateGroupName = internalAction({
  args: {
    link1Title: v.string(),
    link1Description: v.optional(v.string()),
    link2Title: v.string(),
    link2Description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set");
      }
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 100,
        },
      });

      const prompt = `Given these two related links, generate a short (2-4 word) group name with a relevant emoji prefix that describes what they have in common:

Link 1: ${args.link1Title}
${args.link1Description ? `Description: ${args.link1Description}` : ''}

Link 2: ${args.link2Title}
${args.link2Description ? `Description: ${args.link2Description}` : ''}

Return ONLY the group name with emoji, nothing else. Examples: "🤖 AI Tools", "⚡ Productivity Apps", "❤️ Health Resources", "👨‍⚕️ Caregiving Support"`;

      const result = await model.generateContent(prompt);
      const groupName = result.response.text().trim().replace(/['"]/g, '');

      console.log(`Generated group name: "${groupName}"`);
      return groupName;
    } catch (error) {
      console.error("Error generating group name:", error);
      return "Grouped Items";
    }
  },
});

// Group two links together
export const groupLinks = action({
  args: {
    link1Id: v.id("links"),
    link2Id: v.id("links"),
  },
  handler: async (ctx, args) => {
    // Get both links
    const link1 = await ctx.runQuery(internal.linkActions.getLink, { linkId: args.link1Id });
    const link2 = await ctx.runQuery(internal.linkActions.getLink, { linkId: args.link2Id });

    if (!link1 || !link2) {
      throw new Error("Links not found");
    }

    // Check if either link already has a subcategory (is in a group)
    let groupName: string;

    const differentExistingGroups = link1.subcategory && link2.subcategory && link1.subcategory !== link2.subcategory;

    if (differentExistingGroups) {
      // Both had groups already and they differ → create a fresh merged group
      groupName = await ctx.runAction(internal.groupActions.generateGroupName, {
        link1Title: link1.title || link1.para?.name || "Untitled",
        link1Description: link1.description || undefined,
        link2Title: link2.title || link2.para?.name || "Untitled",
        link2Description: link2.description || undefined,
      });
      console.log(`Both links were in different groups, created new group: "${groupName}"`);
    } else if (link2.subcategory) {
      // Target link is already in a group, use that group
      groupName = link2.subcategory;
      console.log(`Adding to existing group: "${groupName}"`);
    } else if (link1.subcategory) {
      // Dragged link is already in a group, use that group
      groupName = link1.subcategory;
      console.log(`Using dragged link's group: "${groupName}"`);
    } else {
      // Neither in a group, generate new name
      groupName = await ctx.runAction(internal.groupActions.generateGroupName, {
        link1Title: link1.title || link1.para?.name || "Untitled",
        link1Description: link1.description || undefined,
        link2Title: link2.title || link2.para?.name || "Untitled",
        link2Description: link2.description || undefined,
      });
      console.log(`Created new group: "${groupName}"`);
    }

    // If buckets differ, align both to the target link's bucket (or the dragged link's if missing)
    const targetBucket = link2.para?.bucket || link1.para?.bucket;

    // Update both links to have the same subcategory (the group name)
    await ctx.runMutation(internal.linkMutations.updateLinkCategory, {
      linkId: args.link1Id,
      subcategory: groupName,
      bucket: targetBucket,
    });

    await ctx.runMutation(internal.linkMutations.updateLinkCategory, {
      linkId: args.link2Id,
      subcategory: groupName,
      bucket: targetBucket,
    });

    return { groupName };
  },
});
