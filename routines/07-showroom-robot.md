# Night run 07: the showroom robot

Status: approved by Smo, 16 Oct 2026
Effort: very heavy
Depends on: nothing
Branch: `night/07-showroom-robot`

## Goal
A small six-legged robot lives in the showroom. It wanders around on its own, like the figure at the camp, and can be clicked. It hides its legs under white shell plates, folds itself into a perfect ball and rolls, and opens up again like a flower. Smo wants it to have the best, most varied animations on the whole site. Quality of motion matters more than anything else in this run.

## References (in `smoaf/portfolio-refs/robot/`, read `README.md` there)
- `orbweaver.glb`: Smo's base model. Smo released this one file for the public site: copy it to `assets/robot/orbweaver.glb` in this repository. It has one skinned mesh (materials Shell, Frame, Metal, Glow, Rubber), a skeleton of `Body` plus six legs (`Coxa_n`, `Femur_n`, `Tibia_n`, `Foot_n`, n = 0 to 5) and five short clips: Idle (6 s), Walk (1 s), Fold (2 s), Roll (1.2 s), Unfold (2 s). About 0.6 m across and 0.6 m tall.
- Five screenshots of the real robot from a video: `pose-walk`, `pose-crouch`, `pose-ball`, `pose-bloom`, `pose-crown`. The phone interface around the picture is not part of the reference. Look at all five closely before building anything, and compare the finished robot against them.

Copy nothing else from `portfolio-refs`.

## What the screenshots show
Study the images yourself as well. This is what Smo and Claude read from them:

**Build**
- **Top: a white dome made of segments.** Thin seams run over it from the top down (a cross of seams is visible in `pose-crouch`). In `pose-crown` and `pose-bloom` these segments open outward like petals, so the dome is not one rigid piece: it is a ring of petal segments, about six, hinged at the dome's lower rim.
- **Middle: a dark frame.** A black, flat body ring under the dome, full of visible mechanics: servos, brackets, wires, small white parts. It shows between the plates in every pose.
- **Below: six legs, each covered by a curved white plate.** Each plate is shaped like a segment of an orange peel (a lune): wide in the middle, narrowing to a point at the bottom, curved outward. In the walk the plate's pointed tip is the foot that touches the ground. The leg mechanics (dark, with joints) are visible behind and above each plate.
- **Surface:** matte white plastic, slightly worn, with dark gaps at all seams. No lights, no face, **no eyes**.

**Poses**
1. **Walk (`pose-walk`):** body raised, dome on top, the six plates standing out round the body at an angle, tips on the ground. Wide stance: the feet span about one and a half times the dome's width.
2. **Crouch (`pose-crouch`):** body low, the plates pulled in close and nearly vertical round the body, tips on the ground. It looks like a closed bud or a jellyfish: dome on top, a skirt of plates below, dark mechanics peeking through the gaps.
3. **Ball (`pose-ball`):** completely closed. The dome forms the upper half of a sphere, the six leg plates fold under the body and form the lower half, their tips meeting at the bottom. The result is a near perfect sphere with fine seams, rolling on its side.
4. **Bloom (`pose-bloom`):** the change between ball and robot. The ball lies tilted, and the plates open outward and upward like the petals of a flower, pointed tips out, with the dark frame and leg joints visible in the middle.
5. **Crown (`pose-crown`):** standing tall on nearly straight legs, leg plates on the ground below. The dome segments are raised upward and open round the top like a crown or a tulip, with a mechanism visible in the centre.

## 1. The model
- Start from `orbweaver.glb` and change it to match the screenshots. Where the base model and the screenshots disagree, the screenshots win.
- **No eyes.** Remove anything that reads as eyes or a face, including the orange `Glow` parts if they read that way. Check from several angles.
- **The dome must open.** The base skeleton has only `Body` and the legs. Split the dome into its petal segments and give each its own bone (or its own node), hinged at the dome rim, so the bloom and crown poses are possible.
- **Plates as lunes:** each leg plate is the exact segment of the sphere it fills in the ball. Check that the six plates plus the dome segments close into one clean sphere.
- Materials follow the screenshots: matte white plates with a faint wear, black frame, dark grey metal, black rubber. Keep the site's plaster-model look in mind: the robot is a small living object inside the model, not a photo-real render.
- Build the changes in code (in `showroom/robot.js` or a Python generator next to the others in `3d/scripts/`). Whatever changes the `.glb`, document it, so the model can be rebuilt.

## 2. The ball (most important single shape)
Smo asked for the ball to be really good.
- **Closed, it is a sphere.** Seen from any side, at rest and while rolling, the silhouette is round. No plate sticks out, no gap is wider than a fine seam, no leg part pokes through. Check this from at least six angles and at close range.
- **Rolling is physically right.** The ball turns exactly by the distance it travels (angle = distance / radius), around the axis at right angles to the direction of travel. No sliding, no spinning in place unless it is meant to.
- **It has weight.** It speeds up and slows down smoothly, wobbles a little when it stops, rocks back and forth once or twice before settling, and bounces softly off walls and benches.
- **Folding into it and opening out of it are the show.** The change between robot and ball is where the robot is most impressive. See the animations below.

## 3. Animations
Build a rich set. Do not rely on the five base clips alone: they are short and generic. Use them as a starting point, and add procedural animation (code that moves the bones each frame) wherever it looks better, especially for walking and turning, so feet plant on the floor and never slide.

General quality rules for every animation:
- Easing everywhere: no linear motion, no snapping. Anticipation before big moves, follow-through and a small settle after them.
- Feet that touch the floor stay planted until they lift. The body bobs slightly with each step.
- Legs never pass through each other, the plates or the floor.
- Every transition between two animations is blended, so any animation can follow any other.

The set (each one different, not variations of one move):
1. **Idle, alive:** slow breathing of the body, small weight shifts from leg to leg, now and then one leg lifts and taps, the dome petals open a crack and close.
2. **Walk:** a tripod gait (three legs at a time) with planted feet, body bob and a slight sway. Speed changes are smooth.
3. **Turn on the spot:** legs step round in sequence while the body rotates.
4. **Look and lean:** it notices the visitor (the camera or the mouse pointer), stops, turns its front towards it and leans in, tilting the body a little to one side, curious.
5. **Crouch and hide:** quickly pulls its legs in and lowers itself into the closed-bud pose (`pose-crouch`), then slowly comes back up and peeks out.
6. **Fold into the ball:** legs draw in one after another in a wave, plates swing under, the dome segments close, and the body tips onto its side as the sphere closes (`pose-ball`).
7. **Roll:** as a ball, it rolls a path across the showroom floor: straight runs, curves and a bounce off a wall or bench. It slows down, rocks and settles.
8. **Bloom out of the ball:** lying on its side, the plates open outward like petals (`pose-bloom`), the legs reach out, push against the floor and flip the body upright, then it shakes itself once.
9. **Crown:** it rises tall on straight legs and opens the dome segments upward (`pose-crown`), holds the pose for a moment, then closes and settles back down. Its big moment.
10. **Stretch:** after waking or unfolding, it stretches each leg outward in turn, a wave going round the body.
11. **Spin:** a happy quick turn on the spot with a small hop.
12. **Wave:** lifts one front leg high and waves the plate.
13. **Peek out of the ball:** still closed, one leg pokes out and feels around, pulls back in, then the full bloom follows.
14. **Sleep:** curls into the ball and stays still, only a very slow breathing in the seams.
15. **Wake up:** from sleep, a few small twitches, then a slow bloom, a stretch and a look around.

## 4. Behaviour in the showroom
- **Where:** the showroom (`PLACES` entry `showroom` in `index.html`). Find a free area on the floor and mark out where it may go. It avoids the benches, speaker towers, sculptures, projector beams and walls, the way the camp figure keeps to its walking graph (`index.html`, from around line 686).
- **On its own:** while the showroom is open, it chooses its next animation at random from a weighted list, with pauses between, so it never repeats the same thing twice in a row. Walking, looking around and idle are common; rolling, crown, spin and wave are rarer and feel special.
- **Day and night:** it follows the station's day and night cycle. At night it mostly sleeps as a ball and only wakes for a moment when clicked. At dawn it does the wake-up animation.
- **Hover:** when the pointer is over it, it notices: it stops and does the look-and-lean animation. It glows a little to show it can be clicked, like the camp figure (no eyes, no light on the robot itself).
- **Click:** a click starts one of the big animations, chosen in an order that feels like a short story: for example crown, then fold and roll, then bloom and spin. Clicking during a big animation does not cut it off.
- **Performance:** it only runs while the showroom is the open place, and it pauses with the rest of the site. Nothing is allocated per frame. Phones keep their frame rate.
- **Connection to the page:** follow the area pattern in `CLAUDE.md` (a folder with one object exporting `setup(host)`, `step()`, `tap`, `hover`, `arrive`, `reset`, `resume` as needed). Suggested folder: `showroom/`.

## Rules for this run
- Follow `CLAUDE.md`. Change only what the robot needs. Do not change the showroom's roof, projectors, panorama or anything else in it.
- No brand names or logos on the robot.
- Test at desktop and phone width, in day and night. Record short screen captures of every animation in the list and of the ball rolling, and compare the poses side by side with the five screenshots. No console errors.
- Add a dated entry to `docs/build-log.md` and a short description of the robot to `docs/portfolio-concept.md` under the showroom.

## Finish
- Open a pull request into `main` from `night/07-showroom-robot`. Show each pose next to its screenshot, list every animation with a short capture, and explain how the robot is put together (model changes, bones, the animation system) so later runs can add more animations.
- Then merge it into `main` as described in `README.md` ("Every run", step 4). Smo tests the live site instead of reviewing the code.

## Decide on your own
Nobody is available during the night run. For each point below, choose the sensible option, build it, and state the choice in the pull request so Smo can change it.
- Size in the showroom: roughly the real robot's size (about 0.6 m), or somewhat larger so it reads from the showroom's view.
- How many dome segments (the screenshots suggest about six).
- If an animation from the list cannot be made to look good in one night, leave it out and say so rather than shipping a weak one.
