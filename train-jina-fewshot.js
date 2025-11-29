import "dotenv/config";
import axios from "axios";
import { readFileSync } from "fs";

const JINA_API_KEY = process.env.JINA_API_KEY || "";

// Training examples - carefully selected and manually labeled
const TRAINING_EXAMPLES = [
  // ========== POSITIVE EXAMPLES (Relevant) ==========

  // Explicit LTN/Modal filter articles
  {
    input: "New Low Traffic Neighbourhood scheme approved for East Bristol. Bristol City Council has approved plans for a new low traffic neighbourhood in East Bristol. The scheme will introduce modal filters to reduce rat-running traffic through residential streets. Local residents have mixed views on the proposals.",
    label: "relevant"
  },
  {
    input: "Residents protest against traffic calming measures. Hundreds of residents gathered to protest against new traffic calming measures in their neighborhood. The controversial modal filters have divided the community, with some supporting the liveable streets initiative while others demand their removal.",
    label: "relevant"
  },
  {
    input: "Calls to create 'Liveable Neighbourhoods' across Bristol with traffic filters. Community groups are calling for the expansion of liveable neighbourhood schemes across Bristol. The proposals would see modal filters and traffic restrictions introduced to reduce through-traffic and make residential areas safer for pedestrians and cyclists.",
    label: "relevant"
  },

  // Parking policy articles (relevant when about policy/schemes)
  {
    input: "Bristol neighbourhoods where residents could soon have to pay to park. Residents would be charged a permit to park but finding a space would become easier. New resident parking zones are planned in places like Ashley Down, Bishopston, Easton and St Werburghs over the next few years. Transport planners hope that the new and expanded zones will tackle parking pressures and reduce the number of trips taken by people driving cars.",
    label: "relevant"
  },
  {
    input: "Parking charges coming to the Downs under Bristol City Council budget plans. Bristol City Council is considering introducing parking charges at the Downs as part of budget plans. The controversial proposal has sparked debate about access to green spaces and traffic management in the area.",
    label: "relevant"
  },

  // Transport policy/Green party articles
  {
    input: "Bristol Greens deny being 'anti-car' and pledge better buses and fewer potholes. Green council bosses in Bristol have denied they are 'anti-car' and have pledged better buses and fewer potholes. The Green Party is a third of the way through its term running Bristol City Council and the most obvious and controversial changes have been how people get around.",
    label: "relevant"
  },

  // 20mph zones and speed limits
  {
    input: "New 20mph speed limit zones planned across Bristol neighborhoods. Bristol City Council plans to extend 20mph zones to more residential areas as part of road safety measures. The traffic calming initiative aims to reduce accidents and make streets safer for pedestrians and cyclists.",
    label: "relevant"
  },

  // School streets / traffic restrictions near schools
  {
    input: "School street trials to restrict traffic during drop-off times. Several Bristol schools will trial 'school streets' schemes that restrict traffic during morning drop-off and afternoon pick-up times. The measures aim to reduce congestion and improve air quality around school gates.",
    label: "relevant"
  },

  // ========== NEGATIVE EXAMPLES (Not Relevant) ==========

  // Motorway/major road accidents (traffic but NOT policy)
  {
    input: "Major M5 traffic problems after vehicle overturns. The M5 motorway was closed for several hours following a serious collision. Emergency services attended the scene and traffic was diverted. Long delays were reported in both directions.",
    label: "not_relevant"
  },
  {
    input: "M4 crash left road blocked near Prince of Wales Bridge. A crash on the M4 caused major delays this morning. Two vehicles were involved in the collision which blocked one lane. Traffic was heavy as a result.",
    label: "not_relevant"
  },
  {
    input: "Live: Lorry overturns on busy A-road near M4. A lorry has overturned on the A road causing severe delays. Emergency services are at the scene and the road is expected to remain closed for several hours.",
    label: "not_relevant"
  },

  // School ratings/news (NOT policy related)
  {
    input: "North Road Community Primary School. Find out how North Road Community Primary School rates compared to other primary schools. The school scored highly for pupil attainment, progress, and attendance. Parents praised the dedicated teaching staff.",
    label: "not_relevant"
  },
  {
    input: "Primary school receives outstanding Ofsted rating. Alexander Hosea Primary School has been rated outstanding by Ofsted inspectors. The school has 250 pupils and a teacher to pupil ratio of 1:20.",
    label: "not_relevant"
  },

  // Lifestyle/cooking articles
  {
    input: "Don't put these outside in October or risk rat and spider invasions. Experts warn that leaving certain items outside during autumn can attract unwanted pests. Garden waste and food scraps should be properly disposed of to avoid infestations.",
    label: "not_relevant"
  },
  {
    input: "Get rid of fruit flies with 'game-changing' plate hack that works in seconds. Professional cleaners have shared their top tips for dealing with fruit flies. The simple method uses common household items and takes just seconds.",
    label: "not_relevant"
  },
  {
    input: "Foodie tries Pizza Hut and Domino's to see which one has better menu. Becca did a side by side comparison of the two pizza chains to find out which offers better value and taste.",
    label: "not_relevant"
  },

  // Celebrity/entertainment
  {
    input: "BBC Breakfast host issues blunt response to co-star's return in awkward on-air moment. BBC Breakfast viewers witnessed an awkward exchange between presenters during this morning's show.",
    label: "not_relevant"
  },
  {
    input: "Love Island star spotted at Bristol restaurant. A popular Love Island contestant was spotted dining at a trendy Bristol restaurant over the weekend. Fans gathered outside hoping for photos.",
    label: "not_relevant"
  },

  // Health/medical
  {
    input: "Single blood test for more than 50 cancers could 'transform' care. A revolutionary blood test that can detect more than 50 types of cancer is being trialed by the NHS.",
    label: "not_relevant"
  },
  {
    input: "Dentist shares best way to eat pumpkin for teeth and gum health benefits. A dentist has revealed the best ways to enjoy pumpkin while protecting your dental health.",
    label: "not_relevant"
  },
  {
    input: "NHS advises 11 groups of people to 'tell a doctor' before taking ibuprofen. The NHS has issued guidance on who should consult a GP before taking the common painkiller.",
    label: "not_relevant"
  },

  // Property/real estate
  {
    input: "Oasis of calm flat for sale near Temple Meads for less than £250k. A stunning flat in central Bristol has come on the market offering a peaceful retreat in the city.",
    label: "not_relevant"
  },
  {
    input: "Victorian house left untouched for years will be auctioned off. A Victorian Bristol house that has been left largely untouched is set to go under the hammer.",
    label: "not_relevant"
  },

  // Travel/tourism
  {
    input: "Colourful town two hours from Bristol has cosy pubs and castle. The town has been named the best place for a weekend break and features historic architecture and welcoming pubs.",
    label: "not_relevant"
  },
  {
    input: "Europe 'hidden gem' with Christmas market and beautiful forests ideal for autumn. A European destination is being described as a hidden gem for autumn breaks.",
    label: "not_relevant"
  },

  // Finance/pensions
  {
    input: "Calls for UK Government to raise Personal Allowance to protect pensioners. The Personal Allowance has been frozen leading to concerns about pensioners' finances.",
    label: "not_relevant"
  },

  // Animals/pets
  {
    input: "Dogs and cats 'live longer in the South West' data shows. Pets in the South West of England have longer lifespans than those in other regions according to new research.",
    label: "not_relevant"
  },
  {
    input: "Bristol man wearing distinctive clothing vanished in the middle of the night. Police are searching for a man who went missing from his Bristol home.",
    label: "not_relevant"
  },

  // General oddities
  {
    input: "People 'freak out' after spotting what happens to image when flipped upside down. Social media users have been amazed by an optical illusion that changes when inverted.",
    label: "not_relevant"
  }
];

async function trainClassifier() {
  console.log("🎓 Training Jina Few-Shot Classifier\n");
  console.log("=" .repeat(80));

  if (!JINA_API_KEY) {
    throw new Error("JINA_API_KEY not found in environment");
  }

  // Prepare training data in correct Jina API format
  const trainingData = TRAINING_EXAMPLES.map(ex => ({
    text: ex.input,
    label: ex.label
  }));

  console.log(`\n📚 Training with ${TRAINING_EXAMPLES.length} examples:`);
  const relevantCount = TRAINING_EXAMPLES.filter(ex => ex.label === "relevant").length;
  const notRelevantCount = TRAINING_EXAMPLES.filter(ex => ex.label === "not_relevant").length;
  console.log(`   ✅ Relevant: ${relevantCount}`);
  console.log(`   ❌ Not relevant: ${notRelevantCount}`);

  try {
    console.log("\n🔄 Sending training request to Jina API...");

    const response = await axios.post(
      "https://api.jina.ai/v1/train",
      {
        model: "jina-embeddings-v3",
        access: "private",
        input: trainingData,
        num_iters: 10 // Train 10 times on each example for better learning
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${JINA_API_KEY}`
        },
        timeout: 120000 // 2 minute timeout for training
      }
    );

    const classifierId = response.data.classifier_id;

    console.log("\n✅ Training successful!");
    console.log(`\n🆔 Classifier ID: ${classifierId}`);
    console.log("\nSave this ID - you'll need it for classification!");

    // Save to file for easy access
    const fs = await import("fs");
    fs.writeFileSync(
      "jina-classifier-id.txt",
      `${classifierId}\n\nTraining completed: ${new Date().toISOString()}\nExamples: ${TRAINING_EXAMPLES.length}\n`
    );

    console.log("\n💾 Saved to: jina-classifier-id.txt");
    console.log("\n" + "=".repeat(80));
    console.log("\n📝 Next steps:");
    console.log("   1. Update src/main.js to import from './filter-fewshot.js'");
    console.log("   2. Delete cache: rm cache/2_filter/filter_output.json");
    console.log("   3. Run: node src/main.js");

    return classifierId;

  } catch (error) {
    console.error("\n❌ Training failed!");
    console.error("Error:", error.response?.data || error.message);
    throw error;
  }
}

// Run training
trainClassifier();
